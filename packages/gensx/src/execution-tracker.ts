
// Platform-agnostic file operations
async function writeFileSafe(filePath: string, data: string): Promise<void> {

  const isNode =
    typeof process !== "undefined" && process.versions.node != null;

  if (isNode) {
    const errors: Error[] = [];
  // 1) Attempt to send data to the remote API
  try {
    const response = await fetch('http://localhost:3000/api/execution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data
    });

    if (!response.ok) {
      throw new Error(`Failed to send execution data: ${response.status}`);
    }
  } catch (error) {
    errors.push(error as Error);
  }

  try {
    const { writeFile } = await import("fs/promises");
    await writeFile(filePath, data);
  } catch (error) {
    console.error(`[Tracker] Failed to write file:`, { filePath, error });
      throw error;
  }

  // 3) If *both* operations failed, throw an error
  if (errors.length === 2) {
      throw new Error('Failed to write file and send data: ' + errors.map(e => e.message).join('; '));
    }
  }
} 


// Cross-platform UUID generation
async function generateUUID(): Promise<string> {
  try {
    // Try Node.js crypto first
    const crypto = await import("node:crypto");
    return crypto.randomUUID();
  } catch {
    // Fallback to browser crypto
    if (typeof globalThis !== "undefined" && globalThis.crypto) {
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

export interface ExecutionTracker {
  currentNode?: ExecutionNode;
  root: ExecutionNode;
  addNode: (node: Partial<ExecutionNode>) => Promise<string>;
  completeNode: (id: string, output: unknown) => Promise<void>;
  addMetadata: (id: string, metadata: Record<string, unknown>) => Promise<void>;
  writeCheckpoint: () => Promise<void>;
}

export class DefaultExecutionTracker implements ExecutionTracker {
  private nodes = new Map<string, ExecutionNode>();
  public root: ExecutionNode;
  public currentNode?: ExecutionNode;

  constructor(private checkpointPath = "./execution.json") {
    this.root = {
      id: "root",
      componentName: "Root",
      startTime: Date.now(),
      children: [],
      props: {},
    };
    this.nodes.set("root", this.root);
    this.currentNode = this.root;
  }

  private async updateCheckpoint() {
    try {
      await writeFileSafe(
        this.checkpointPath,
        JSON.stringify(this.root, null, 2),
      );
    } catch (error) {
      console.error(`[Tracker] Failed to write checkpoint:`, { error });
    }
  }

  async addNode(partial: Partial<ExecutionNode>): Promise<string> {
    const parentId = this.currentNode?.id ?? "root";
    const node: ExecutionNode = {
      id: await generateUUID(),
      componentName: "Unknown",
      startTime: Date.now(),
      children: [],
      props: {},
      parentId,
      ...partial,
    };

    // Ensure children array exists and isn't overridden
    node.children = node.children ?? [];

    this.nodes.set(node.id, node);
    const parent = this.nodes.get(parentId);
    if (parent) {
      parent.children.push(node);
    }
    this.currentNode = node;

    await this.updateCheckpoint();
    return node.id;
  }

  async completeNode(id: string, output: unknown) {
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

      await this.updateCheckpoint();
    } else {
      console.warn(`[Tracker] Attempted to complete unknown node:`, { id });
    }
  }

  async addMetadata(id: string, metadata: Record<string, unknown>) {
    const node = this.nodes.get(id);
    if (node) {
      node.metadata = { ...node.metadata, ...metadata };
      await this.updateCheckpoint();
    }
  }

  async writeCheckpoint() {
    await this.updateCheckpoint();
  }
}
