import { resolveDeep } from "./resolve";
import {
  ComponentProps,
  Context,
  ExecutableValue,
  WorkflowComponent,
} from "./types";

type WorkflowContext = Record<symbol, unknown>;

// Create unique symbols for each context
let contextCounter = 0;
function createContextSymbol() {
  return Symbol.for(`gensx.context.${contextCounter++}`);
}

export function createContext<T>(defaultValue: T): Context<T> {
  const contextSymbol = createContextSymbol();

  const context = {
    __type: "Context" as const,
    defaultValue,
    symbol: contextSymbol,
    Provider: ((props: ComponentProps<{ value: T }, never>) => {
      return () => {
        const children = props.children;
        if (!children) {
          console.warn("Provider has no children");
          return null as never;
        }
        return withContext({ [contextSymbol]: props.value }, () => {
          return children(null as never);
        });
      };
    }) as WorkflowComponent<{ value: T }, never>,
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

class ExecutionContext {
  constructor(
    public context: WorkflowContext,
    private parent?: ExecutionContext,
  ) {}

  withContext(newContext: Partial<WorkflowContext>): ExecutionContext {
    if (Object.getOwnPropertySymbols(newContext).length === 0) {
      return this;
    }

    // Create a new context that inherits from the current one
    const mergedContext = {} as WorkflowContext;
    for (const key of Object.getOwnPropertySymbols(this.context)) {
      mergedContext[key] = this.context[key];
    }
    // Override with new values
    for (const key of Object.getOwnPropertySymbols(newContext)) {
      mergedContext[key] = newContext[key];
    }
    return new ExecutionContext(mergedContext, this);
  }

  get<K extends keyof WorkflowContext>(key: K): WorkflowContext[K] | undefined {
    if (key in this.context) {
      return this.context[key];
    }
    return this.parent?.get(key);
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
  context: Partial<WorkflowContext>,
  fn: ExecutableValue,
): Promise<T> {
  await configureAsyncLocalStorage;
  const prevContext = contextManager.getCurrentContext();
  const newContext = prevContext.withContext(context);

  return contextManager.run(newContext, async () => {
    const result = await resolveDeep(fn);
    return result as T;
  });
}

// Export for testing or advanced use cases
export function getCurrentContext(): ExecutionContext {
  return contextManager.getCurrentContext();
}
