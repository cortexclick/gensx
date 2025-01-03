import { resolveDeep } from "./resolve";
import { ExecutableValue, type WorkflowContext } from "./types";

export class ExecutionContext {
  constructor(
    public context: WorkflowContext,
    private parent?: ExecutionContext,
  ) {}

  // Create a new context inheriting from this one
  withContext(context: Partial<WorkflowContext>): ExecutionContext {
    // If new context has streaming enabled, mark parent as having had streaming
    if (context.streaming) {
      this.context.hadStreaming = true;
      if (this.parent) {
        this.parent.context.hadStreaming = true;
      }
    }
    return new ExecutionContext({ ...this.context, ...context }, this);
  }

  // Create a new fork for parallel execution
  fork(): ExecutionContext {
    return new ExecutionContext({ ...this.context }, this);
  }

  // Get value from current context or inherit from parent
  get<K extends keyof WorkflowContext>(key: K): WorkflowContext[K] | undefined {
    if (key in this.context) {
      return this.context[key];
    }
    return this.parent?.get(key);
  }

  // Check if this context or any parent context has streaming enabled
  hasStreamingInChain(): boolean {
    if (this.context.streaming) {
      return true;
    }
    return this.parent?.hasStreamingInChain() ?? false;
  }

  // Check if this context or any parent ever had streaming
  hadStreamingInChain(): boolean {
    if (this.context.hadStreaming) {
      return true;
    }
    return this.parent?.hadStreamingInChain() ?? false;
  }

  // Get context info for logging
  getContextInfo() {
    return {
      streaming: this.get("streaming"),
      hadStreaming: this.get("hadStreaming"),
      hasStreamingInChain: this.hasStreamingInChain(),
      hadStreamingInChain: this.hadStreamingInChain(),
      parentInfo: this.parent
        ? {
            streaming: this.parent.get("streaming"),
            hadStreaming: this.parent.get("hadStreaming"),
            hasStreamingInChain: this.parent.hasStreamingInChain(),
            hadStreamingInChain: this.parent.hadStreamingInChain(),
          }
        : null,
    };
  }
}

// Global root context
const rootContext = new ExecutionContext({});

// Get the current context in the execution
let currentContext: ExecutionContext = rootContext;

export function getCurrentContext(): ExecutionContext {
  return currentContext;
}

export function setCurrentContext(context: ExecutionContext): void {
  currentContext = context;
}

// Helper to run code with a specific context
export async function withContext<T>(
  context: Partial<WorkflowContext>,
  fn: ExecutableValue,
): Promise<T> {
  const prevContext = getCurrentContext();
  if (Object.keys(context).length > 0) {
    const newContext = prevContext.withContext(context);
    setCurrentContext(newContext);
  }
  try {
    const result = await resolveDeep(fn);
    return result as T;
  } finally {
    setCurrentContext(prevContext);
  }
}
