import { ExecutionContext, getCurrentContext } from "./context";
import { isStreamable } from "./stream";
import { ExecutableValue } from "./types";

/**
 * Deeply resolves any value, handling promises, arrays, objects, and JSX elements.
 * This is the core resolution logic used by both execute() and the JSX runtime.
 */
export async function resolveDeep<T>(value: unknown): Promise<T> {
  // Handle promises first
  if (value instanceof Promise) {
    const resolved = (await value) as Promise<T>;
    return resolveDeep(resolved);
  }

  if (value instanceof ExecutionContext) {
    return value as T;
  }

  // Pass through any async iterable without consuming it
  if (value && typeof value === "object" && Symbol.asyncIterator in value) {
    return value as T;
  }

  // Pass through streamable values - they are handled by execute (StreamComponent)
  if (isStreamable(value)) {
    return value as unknown as T;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const resolvedArray = await Promise.all(
      value.map((item) => resolveDeep(item)),
    );
    return resolvedArray as T;
  }

  // Handle primitive wrapper objects (Number, String, Boolean)
  if (value instanceof Number) return value.valueOf() as T;
  if (value instanceof String) return value.valueOf() as T;
  if (value instanceof Boolean) return value.valueOf() as T;

  // Handle functions first
  if (typeof value === "function" && value.name !== "Object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if ((value as any).__gsxFramework) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return await resolveDeep(value());
    }

    return value as T;
  }

  // Then handle objects (but not null)
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    const resolvedEntries = await Promise.all(
      entries.map(async ([key, val]) => [key, await resolveDeep(val)]),
    );
    return Object.fromEntries(resolvedEntries) as T;
  }

  // Base case: primitive value
  return value as T;
}

/**
 * Executes a JSX element or any other value, ensuring all promises and nested values are resolved.
 * This is the main entry point for executing workflow components.
 */
export async function execute<T>(element: ExecutableValue): Promise<T> {
  const context = getCurrentContext().getWorkflowContext();
  const result = (await resolveDeep(element)) as T;
  context.checkpointManager.write();
  return result;
}
