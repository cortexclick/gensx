// Cross-platform UUID generation
async function generateUUID(): Promise<string> {
  try {
    // Try Node.js crypto first
    const crypto = await import("node:crypto");
    return crypto.randomUUID();
  } catch {
    // Fallback to browser crypto
    if (typeof globalThis !== "undefined") {
      return globalThis.crypto.randomUUID();
    }
    // Simple fallback for environments without crypto
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
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
}

export interface CheckpointWriter {
  currentNode?: ExecutionNode;
  root?: ExecutionNode;
  addNode: (node: Partial<ExecutionNode>) => Promise<string>;
  completeNode: (id: string, output: unknown) => void;
  addMetadata: (id: string, metadata: Record<string, unknown>) => void;
  write: () => void;
  checkpointsEnabled: boolean;
}

export class CheckpointManager implements CheckpointWriter {
  private nodes = new Map<string, ExecutionNode>();
  public root?: ExecutionNode;
  public currentNode?: ExecutionNode;
  public checkpointsEnabled: boolean;

  // Track active checkpoint write
  private activeCheckpoint: Promise<void> | null = null;
  private pendingUpdate = false;

  constructor() {
    // Set checkpointsEnabled based on environment variable
    // Environment variables are strings, so check for common truthy values
    const checkpointsEnv = process.env.GENSX_CHECKPOINTS?.toLowerCase();
    this.checkpointsEnabled =
      checkpointsEnv === "true" ||
      checkpointsEnv === "1" ||
      checkpointsEnv === "yes";
  }

  // updateCheckpoint POSTs the current component tree to the GenSX API.
  // Special care is taken to do this in a non-blocking manner, and in a way that
  // minimizes chattiness with the server.
  // We only write one checkpoint at a time. If another checkpoint comes in while
  // we're still processing, we just mark that we need another update and return.
  // When the current checkpoint write is complete, we check if there was a pending
  // update request, and if so, we trigger another write.
  private updateCheckpoint() {
    if (!this.checkpointsEnabled || !this.root) {
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
      const response = await fetch("http://localhost:3000/api/execution", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.root),
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
  }

  async addNode(partial: Partial<ExecutionNode>) {
    const node: ExecutionNode = {
      id: await generateUUID(),
      componentName: "Unknown",
      startTime: Date.now(),
      children: [],
      props: {},
      ...partial,
    };

    this.nodes.set(node.id, node);

    if (!this.root) {
      // First node becomes the root
      this.root = node;
    } else if (this.currentNode) {
      // Add as child to current node
      node.parentId = this.currentNode.id;
      this.currentNode.children.push(node);
    }

    this.currentNode = node;
    this.updateCheckpoint();
    return node.id;
  }

  completeNode(id: string, output: unknown) {
    const node = this.nodes.get(id);
    if (node) {
      node.endTime = Date.now();
      node.output = output;

      if (node.parentId) {
        const parent = this.nodes.get(node.parentId);
        this.currentNode = parent;
      } else {
        this.currentNode = undefined;
      }

      this.updateCheckpoint();
    } else {
      console.warn(`[Tracker] Attempted to complete unknown node:`, { id });
    }
  }

  addMetadata(id: string, metadata: Record<string, unknown>) {
    const node = this.nodes.get(id);
    if (node) {
      node.metadata = { ...node.metadata, ...metadata };
      this.updateCheckpoint();
    }
  }

  write() {
    this.updateCheckpoint();
  }
}
