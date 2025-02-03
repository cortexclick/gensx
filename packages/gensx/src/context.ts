import { resolveDeep } from "./resolve";
import { Args, Context } from "./types";
import {
  createWorkflowContext,
  WORKFLOW_CONTEXT_SYMBOL,
  WorkflowExecutionContext,
} from "./workflow-context";

export type WorkflowContext = Record<symbol, unknown>;

// Create unique symbols for each context
let contextCounter = 0;
function createContextSymbol() {
  return Symbol.for(`gensx.context.${contextCounter++}`);
}

export function createContext<T>(defaultValue: T): Context<T> {
  const contextSymbol = createContextSymbol();

  function Provider(props: Args<{ value: T }, ExecutionContext>) {
    return () => {
      const currentContext = getCurrentContext();

      return Promise.resolve(
        currentContext.withContext({ [contextSymbol]: props.value }),
      );
    };
  }

  const context = {
    __type: "Context" as const,
    defaultValue,
    symbol: contextSymbol,
    Provider,
  };

  return context;
}

export function useContext<T>(context: Context<T>): T {
  const executionContext = getCurrentContext();
  const value = executionContext.get(context.symbol);

  if (value === undefined) {
    return context.defaultValue;
  }

  return value as T;
}

// Define AsyncLocalStorage type based on Node.js definitions
interface AsyncLocalStorageType<T> {
  disable(): void;
  getStore(): T | undefined;
  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R;
  enterWith(store: T): void;
}

export const CURRENT_NODE_SYMBOL = Symbol.for("gensx.currentNode");

export class ExecutionContext {
  constructor(
    public readonly workflowContext: WorkflowContext = {},
    public readonly isExecuteChildScope = false,
  ) {
    if (!this.workflowContext[WORKFLOW_CONTEXT_SYMBOL]) {
      this.workflowContext[WORKFLOW_CONTEXT_SYMBOL] = createWorkflowContext();
    }
  }

  withContext(newContext: WorkflowContext): ExecutionContext {
    // Create a new context that inherits from the current one
    const mergedContext: WorkflowContext = {};
    for (const key of Object.getOwnPropertySymbols(this.workflowContext)) {
      mergedContext[key] = this.workflowContext[key];
    }
    // Override with new values
    for (const key of Object.getOwnPropertySymbols(newContext)) {
      mergedContext[key] = newContext[key];
    }
    return new ExecutionContext(mergedContext, this.isExecuteChildScope);
  }

  get<T>(key: symbol): T | undefined {
    return this.workflowContext[key] as T | undefined;
  }

  getWorkflowContext(): WorkflowExecutionContext {
    return this.get(WORKFLOW_CONTEXT_SYMBOL)!;
  }

  getCurrentNodeId(): string | undefined {
    return this.get(CURRENT_NODE_SYMBOL);
  }

  withNode(nodeId: string): ExecutionContext {
    return this.withContext({ [CURRENT_NODE_SYMBOL]: nodeId });
  }

  withNodeScope<T>(nodeId: string, fn: () => Promise<T>): Promise<T> {
    return withContext(this.withNode(nodeId), fn);
  }

  withWorkflowContext(
    workflowContext: Record<string, unknown>,
  ): ExecutionContext {
    return new ExecutionContext(workflowContext, this.isExecuteChildScope);
  }
}

// Try to import AsyncLocalStorage if available (Node.js environment)
let AsyncLocalStorage: (new <T>() => AsyncLocalStorageType<T>) | undefined;
let contextStorage: AsyncLocalStorageType<ExecutionContext> | null = null;
const configureAsyncLocalStorage = (async () => {
  try {
    const asyncHooksModule = await import("node:async_hooks");
    AsyncLocalStorage = asyncHooksModule.AsyncLocalStorage;
    contextStorage = new AsyncLocalStorage<ExecutionContext>();
  } catch {
    // This is probably an environment without async_hooks, so just use global state and warn the developer
    console.warn(
      "Running in an environment without async_hooks - using global context state. This will only cause issues if concurrent workflows are executed simultaneously.",
    );
  }
})();

const rootContext = new ExecutionContext({});

// Private fallback state
let globalContext = rootContext;

const contextManager = {
  getCurrentContext(): ExecutionContext {
    if (contextStorage) {
      const store = contextStorage.getStore();
      return store ?? rootContext;
    }
    return globalContext;
  },

  run<T>(context: ExecutionContext, fn: () => Promise<T>): Promise<T> {
    if (contextStorage) {
      return contextStorage.run(context, fn);
    }
    const prevContext = globalContext;
    globalContext = context;
    try {
      return fn();
    } finally {
      globalContext = prevContext;
    }
  },
};

// Helper to run code with a specific context
export async function withContext<T>(
  context: ExecutionContext,
  fn: () => Promise<T>,
): Promise<T> {
  await configureAsyncLocalStorage;

  return contextManager.run(context, async () => {
    const result = await resolveDeep(fn);
    return result as T;
  });
}

// Export for testing or advanced use cases
export function getCurrentContext(): ExecutionContext {
  return contextManager.getCurrentContext();
}
