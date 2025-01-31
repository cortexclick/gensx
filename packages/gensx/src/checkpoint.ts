import { join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

import { ComponentOpts, STREAMING_PLACEHOLDER } from "./component";

const gzipAsync = promisify(gzip);

// Cross-platform UUID generation
function generateUUID(): string {
  try {
    const crypto = globalThis.crypto;
    return crypto.randomUUID();
  } catch {
    // Simple fallback for environments without crypto
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export interface ExecutionNode {
  id: string;
  componentName: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  props: Record<string, unknown>;
  output?: unknown;
  children: ExecutionNode[];
  metadata?: {
    logs?: string[];
    tokenCounts?: {
      input: number;
      output: number;
    };
    [key: string]: unknown;
  };
  componentOpts?: ComponentOpts;
}

export interface CheckpointWriter {
  root?: ExecutionNode;
  addNode: (node: Partial<ExecutionNode>, parentId?: string) => string;
  completeNode: (id: string, output: unknown) => void;
  addMetadata: (id: string, metadata: Record<string, unknown>) => void;
  updateNode: (id: string, updates: Partial<ExecutionNode>) => void;
  write: () => void;
  waitForPendingUpdates: () => Promise<void>;
  checkpointsEnabled: boolean;
}

export class CheckpointManager implements CheckpointWriter {
  private nodes = new Map<string, ExecutionNode>();
  private orphanedNodes = new Map<string, Set<ExecutionNode>>();
  private _secretValues = new Map<string, Set<unknown>>(); // Internal per-node secrets
  private currentNodeChain: string[] = []; // Track current execution context
  private readonly MIN_SECRET_LENGTH = 8;
  public root?: ExecutionNode;
  public checkpointsEnabled: boolean;

  // Track active checkpoint write
  private activeCheckpoint: Promise<void> | null = null;
  private pendingUpdate = false;
  private version = 1;
  private org = "";
  private apiKey = "";

  // Provide unified view of all secrets
  get secretValues(): Set<unknown> {
    const allSecrets = new Set<unknown>();
    for (const secrets of this._secretValues.values()) {
      for (const secret of secrets) {
        allSecrets.add(secret);
      }
    }
    return allSecrets;
  }

  constructor(opts?: { apiKey: string; org: string; disabled?: boolean }) {
    // The presence of a apiKey is enough to enable checkpoints, but it can be disabled by setting GENSX_CHECKPOINTS=false
    // org must also be set to record checkpoints.
    const apiKey = opts?.apiKey ?? process.env.GENSX_API_KEY;
    const org = opts?.org ?? process.env.GENSX_ORG;

    this.checkpointsEnabled = apiKey !== undefined;
    this.org = org ?? "";
    this.apiKey = apiKey ?? "";

    if (
      opts?.disabled ||
      process.env.GENSX_CHECKPOINTS === "false" ||
      process.env.GENSX_CHECKPOINTS === "0" ||
      process.env.GENSX_CHECKPOINTS === "no" ||
      process.env.GENSX_CHECKPOINTS === "off"
    ) {
      this.checkpointsEnabled = false;
    }

    if (!this.checkpointsEnabled) {
      return;
    }

    if (!this.org) {
      throw new Error(
        "GENSX_ORG is not set, must be set to record checkpoints. You can disable checkpoints by setting GENSX_CHECKPOINTS=false or unsetting GENSX_API_KEY.",
      );
    }
  }

  private attachToParent(node: ExecutionNode, parent: ExecutionNode) {
    node.parentId = parent.id;
    if (!parent.children.some((child) => child.id === node.id)) {
      parent.children.push(node);
    }
  }

  private handleOrphanedNode(node: ExecutionNode, expectedParentId: string) {
    let orphans = this.orphanedNodes.get(expectedParentId);
    if (!orphans) {
      orphans = new Set();
      this.orphanedNodes.set(expectedParentId, orphans);
    }
    orphans.add(node);

    // Add diagnostic timeout to detect stuck orphans
    this.checkOrphanTimeout(node.id, expectedParentId);
  }

  private checkOrphanTimeout(nodeId: string, expectedParentId: string) {
    setTimeout(() => {
      const orphans = this.orphanedNodes.get(expectedParentId);
      if (orphans?.has(this.nodes.get(nodeId)!)) {
        console.warn(
          `[Checkpoint] Node ${nodeId} (${this.nodes.get(nodeId)?.componentName}) still waiting for parent ${expectedParentId} after 5s`,
          {
            node: this.nodes.get(nodeId),
            existingNodes: Array.from(this.nodes.entries()).map(
              ([id, node]) => ({
                id,
                componentName: node.componentName,
                parentId: node.parentId,
              }),
            ),
          },
        );
      }
    }, 5000);
  }

  /**
   * Validates that the execution tree is in a complete state where:
   * 1. Root node exists
   * 2. No orphaned nodes are waiting for parents
   * 3. All parent-child relationships are properly connected
   */
  private isTreeValid(): boolean {
    // No root means tree isn't valid
    if (!this.root) return false;

    // If we have orphaned nodes, tree isn't complete
    if (this.orphanedNodes.size > 0) return false;

    // Verify all nodes in the tree have their parents
    const verifyNode = (node: ExecutionNode): boolean => {
      for (const child of node.children) {
        if (child.parentId !== node.id) return false;
        if (!verifyNode(child)) return false;
      }
      return true;
    };

    return verifyNode(this.root);
  }

  /**
   * Updates the checkpoint in a non-blocking manner while ensuring consistency.
   * Special care is taken to:
   * 1. Queue updates instead of writing immediately to minimize API calls
   * 2. Only write one checkpoint at a time to maintain order
   * 3. Track pending updates to ensure no state is lost
   * 4. Validate tree completeness before writing
   *
   * The flow is:
   * 1. If a write is in progress, mark pendingUpdate = true
   * 2. When write completes, check pendingUpdate and trigger another write if needed
   * 3. Only write if tree is valid (has root and no orphans)
   */
  private updateCheckpoint() {
    if (!this.checkpointsEnabled) {
      return;
    }

    // Only write if we have a valid tree
    if (!this.isTreeValid()) {
      this.pendingUpdate = true;
      return;
    }

    // If there's already a pending update, just mark that we need another update
    if (this.activeCheckpoint) {
      this.pendingUpdate = true;
      return;
    }

    // Start a new checkpoint write
    this.activeCheckpoint = this.writeCheckpoint().finally(() => {
      this.activeCheckpoint = null;

      // If there was a pending update requested while we were writing,
      // trigger another write
      if (this.pendingUpdate) {
        this.pendingUpdate = false;
        this.updateCheckpoint();
      }
    });
  }

  private async writeCheckpoint() {
    if (!this.root) return;

    try {
      // Create a deep copy of the execution tree for masking
      const maskedRoot = this.maskExecutionTree(structuredClone(this.root));
      const baseUrl =
        process.env.GENSX_CHECKPOINT_URL ?? "https://api.gensx.com";
      const url = join(baseUrl, `/org/${this.org}/executions`);
      const steps = this.countSteps(this.root);

      // Separately gzip the rawExecution data
      const compressedExecution = await gzipAsync(
        Buffer.from(
          JSON.stringify({
            ...maskedRoot,
            updatedAt: Date.now(),
          }),
          "utf-8",
        ),
      );
      const base64CompressedExecution =
        Buffer.from(compressedExecution).toString("base64");

      const payload = {
        executionId: this.root.id,
        version: this.version,
        schemaVersion: 2,
        workflowName: this.root.componentName,
        startedAt: this.root.startTime,
        completedAt: this.root.endTime,
        rawExecution: base64CompressedExecution,
        steps,
      };

      const compressedData = await gzipAsync(JSON.stringify(payload));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
          Authorization: `Bearer ${this.apiKey}`,
          "accept-encoding": "gzip",
        },
        body: compressedData,
      });

      if (!response.ok) {
        console.error(`[Checkpoint] Failed to save checkpoint, server error:`, {
          status: response.status,
          message: await response.text(),
        });
      }
    } catch (error) {
      console.error(`[Checkpoint] Failed to save checkpoint:`, { error });
    }
    // Always increment, just in case the write was received by the server. The version value does not need to be
    // perfectly monotonic, just simply the next value needs to be greater than the previous value.
    this.version++;
  }

  private countSteps(node: ExecutionNode): number {
    return node.children.reduce(
      (acc, child) => acc + this.countSteps(child),
      1,
    );
  }

  private maskExecutionTree(node: ExecutionNode): ExecutionNode {
    // Mask props
    node.props = this.scrubSecrets(node.props, node.id) as Record<
      string,
      unknown
    >;

    // Mask output if present
    if (node.output !== undefined) {
      node.output = this.scrubSecrets(node.output, node.id, "output");
    }

    // Mask metadata if present
    if (node.metadata) {
      node.metadata = this.scrubSecrets(
        node.metadata,
        node.id,
        "metadata",
      ) as Record<string, unknown>;
    }

    // Recursively mask children
    node.children = node.children.map((child) => this.maskExecutionTree(child));

    return node;
  }

  private isEqual(a: unknown, b: unknown): boolean {
    // Handle primitives
    if (a === b) return true;

    // If either isn't an object, they're not equal
    if (!a || !b || typeof a !== "object" || typeof b !== "object") {
      return false;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      return (
        a.length === b.length &&
        a.every((item, index) => this.isEqual(item, b[index]))
      );
    }

    // Handle objects
    if (!Array.isArray(a) && !Array.isArray(b)) {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      return (
        aKeys.length === bKeys.length &&
        aKeys.every((key) =>
          this.isEqual(a[key as keyof typeof a], b[key as keyof typeof b]),
        )
      );
    }

    return false;
  }

  private withNode<T>(nodeId: string, fn: () => T): T {
    this.currentNodeChain.push(nodeId);
    try {
      return fn();
    } finally {
      this.currentNodeChain.pop();
    }
  }

  private getEffectiveSecrets(): Set<unknown> {
    const allSecrets = new Set<unknown>();
    // Collect secrets from current node and all ancestors
    for (const nodeId of this.currentNodeChain) {
      const nodeSecrets = this._secretValues.get(nodeId);
      if (nodeSecrets) {
        for (const secret of nodeSecrets) {
          allSecrets.add(secret);
        }
      }
    }
    return allSecrets;
  }

  private registerSecrets(
    props: Record<string, unknown>,
    paths: string[],
    nodeId: string,
  ) {
    this.withNode(nodeId, () => {
      // Initialize secrets set for this node
      let nodeSecrets = this._secretValues.get(nodeId);
      if (!nodeSecrets) {
        nodeSecrets = new Set();
        this._secretValues.set(nodeId, nodeSecrets);
      }

      // Use paths purely for collection
      for (const path of paths) {
        const value = this.getValueAtPath(props, path);
        if (value !== undefined) {
          this.collectSecretValues(value, nodeSecrets);
        }
      }
    });
  }

  private collectSecretValues(
    data: unknown,
    nodeSecrets: Set<unknown>,
    visited = new WeakSet(),
  ): void {
    // Skip if already visited to prevent cycles
    if (data && typeof data === "object") {
      if (visited.has(data)) {
        return;
      }
      visited.add(data);
    }

    // Handle primitive values
    if (typeof data === "string") {
      if (data.length >= this.MIN_SECRET_LENGTH) {
        nodeSecrets.add(data);
      }
      return;
    }

    // Skip other primitives
    if (!data || typeof data !== "object") {
      return;
    }

    // Handle arrays and objects (excluding ArrayBuffer views)
    if (Array.isArray(data) || !ArrayBuffer.isView(data)) {
      const values = Array.isArray(data) ? data : Object.values(data);
      values.forEach((value) => {
        this.collectSecretValues(value, nodeSecrets, visited);
      });
    }
  }

  private scrubSecrets(data: unknown, nodeId?: string, path = ""): unknown {
    return this.withNode(nodeId ?? "", () => {
      // Handle primitive values
      if (typeof data === "string" || typeof data === "number") {
        const strValue = String(data);
        return this.scrubString(strValue);
      }

      // Skip other primitives
      if (!data || typeof data !== "object") {
        return data;
      }

      // Handle arrays
      if (Array.isArray(data)) {
        return data.map((item, index) =>
          this.scrubSecrets(
            item,
            nodeId,
            path ? `${path}.${index}` : `${index}`,
          ),
        );
      }

      // Handle objects (excluding ArrayBuffer views)
      if (!ArrayBuffer.isView(data)) {
        return Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            this.scrubSecrets(value, nodeId, path ? `${path}.${key}` : key),
          ]),
        );
      }

      return data;
    });
  }

  private scrubString(value: string): string {
    const effectiveSecrets = this.getEffectiveSecrets();
    let result = value;

    // Sort secrets by length (longest first) to handle overlapping secrets correctly
    const secrets = Array.from(effectiveSecrets)
      .filter(
        (s) => typeof s === "string" && s.length >= this.MIN_SECRET_LENGTH,
      )
      .sort((a, b) => String(b).length - String(a).length);

    // Replace each secret with [secret]
    for (const secret of secrets) {
      if (typeof secret === "string") {
        // Only replace if the secret is actually in the string
        if (result.includes(secret)) {
          const escapedSecret = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedSecret, "g");
          result = result.replace(regex, "[secret]");
        }
      }
    }

    return result;
  }

  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((curr: unknown, key: string) => {
      if (curr && typeof curr === "object") {
        return (curr as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Due to the async nature of component execution, nodes can arrive in any order.
   * For example, in a tree like:
   *    BlogWriter
   *      └─ OpenAIProvider
   *         └─ Research
   *
   * The Research component might execute before OpenAIProvider due to:
   * - Parallel execution of components
   * - Different resolution times for promises
   * - Network delays in API calls
   *
   * To handle this, we:
   * 1. Track orphaned nodes (children with parentIds where parents aren't yet in the graph) because:
   *    - We need to maintain the true hierarchy regardless of arrival order
   *    - We can't write incomplete checkpoints that would show incorrect relationships
   *    - The tree structure is important for debugging and monitoring
   *
   * 2. Allow root replacement because:
   *    - The first node to arrive might not be the true root
   *    - We need to maintain correct component hierarchy for visualization
   *    - Checkpoint consumers expect a complete, properly ordered tree
   *
   * This approach ensures that even if components resolve out of order,
   * the final checkpoint will always show the correct logical structure
   * of the execution.
   */
  addNode(partialNode: Partial<ExecutionNode>, parentId?: string): string {
    const nodeId = generateUUID();
    const node: ExecutionNode = {
      id: nodeId,
      componentName: "Unknown",
      startTime: Date.now(),
      children: [],
      props: {},
      ...partialNode,
    };

    // Register any secrets from componentOpts
    if (node.componentOpts?.secretProps) {
      this.registerSecrets(node.props, node.componentOpts.secretProps, nodeId);
    }

    // Store raw values - masking happens at write time
    this.nodes.set(node.id, node);

    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        // Normal case - parent exists
        this.attachToParent(node, parent);
      } else {
        // Parent doesn't exist yet - track as orphaned
        node.parentId = parentId;
        this.handleOrphanedNode(node, parentId);
      }
    } else {
      // Handle root node case
      if (!this.root) {
        this.root = node;
      } else if (this.root.parentId === node.id) {
        // Current root was waiting for this node as parent
        this.attachToParent(this.root, node);
        this.root = node;
      } else {
        console.warn(
          `[Checkpoint] Multiple root nodes detected: existing=${this.root.componentName}, new=${node.componentName}`,
        );
      }
    }

    // Check if this node is a parent any orphans are waiting for
    const waitingChildren = this.orphanedNodes.get(node.id);
    if (waitingChildren) {
      // Attach all waiting children
      for (const orphan of waitingChildren) {
        this.attachToParent(orphan, node);
      }
      // Clear the orphans list for this parent
      this.orphanedNodes.delete(node.id);
    }

    this.updateCheckpoint();
    return node.id;
  }

  completeNode(id: string, output: unknown) {
    const node = this.nodes.get(id);
    if (node) {
      node.endTime = Date.now();
      // Store raw output - masking happens at write time
      node.output = output;

      // If output is marked as secret and not the streaming placeholder, collect secrets
      if (
        node.componentOpts?.secretOutputs &&
        output !== STREAMING_PLACEHOLDER
      ) {
        this.withNode(id, () => {
          let nodeSecrets = this._secretValues.get(id);
          if (!nodeSecrets) {
            nodeSecrets = new Set();
            this._secretValues.set(id, nodeSecrets);
          }
          this.collectSecretValues(output, nodeSecrets);
        });
      }

      this.updateCheckpoint();
    } else {
      console.warn(`[Tracker] Attempted to complete unknown node:`, { id });
    }
  }

  addMetadata(id: string, metadata: Record<string, unknown>) {
    const node = this.nodes.get(id);
    if (node) {
      // Store raw metadata - masking happens at write time
      node.metadata = {
        ...node.metadata,
        ...metadata,
      };
      this.updateCheckpoint();
    }
  }

  updateNode(id: string, updates: Partial<ExecutionNode>) {
    const node = this.nodes.get(id);
    if (node) {
      // If output is being updated and it's marked as secret (and not the placeholder), collect secrets
      if (
        "output" in updates &&
        node.componentOpts?.secretOutputs &&
        updates.output !== STREAMING_PLACEHOLDER
      ) {
        this.withNode(id, () => {
          let nodeSecrets = this._secretValues.get(id);
          if (!nodeSecrets) {
            nodeSecrets = new Set();
            this._secretValues.set(id, nodeSecrets);
          }
          this.collectSecretValues(updates.output, nodeSecrets);
        });
      }

      Object.assign(node, updates);
      this.updateCheckpoint();
    } else {
      console.warn(`[Tracker] Attempted to update unknown node:`, { id });
    }
  }

  write() {
    this.updateCheckpoint();
  }

  async waitForPendingUpdates(): Promise<void> {
    // If there's an active checkpoint, wait for it
    if (this.activeCheckpoint) {
      await this.activeCheckpoint;
    }
    // If that checkpoint triggered another update, wait again
    if (this.pendingUpdate || this.activeCheckpoint) {
      await this.waitForPendingUpdates();
    }
  }
}
