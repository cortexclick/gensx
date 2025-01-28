import type { GsxTool } from "./tools";

import { ExecutionContext } from "./context";
import { JSX } from "./jsx-runtime";

export type MaybePromise<T> = T | Promise<T>;

export type Element = JSX.Element;

export type Primitive = string | number | boolean | null | undefined;

/**
 * This allows an element to return either a plain object or an object with JSX.Element children
 * This is useful for components that return a nested object structure, where each key can be a component
 * that returns a plain object or an object with JSX.Element children.
 *
 * For example:
 *
 * interface ComponentOutput {
 *   nested: {
 *     foo: string;
 *     bar: string;
 *   }[];
 * }
 *
 * interface Args {
 *   input: string;
 * }
 *
 * const Component = gsx.Component<Args, ComponentOutput>(
 *   "Component",
 *   ({ input }) => ({
 *     nested: [
 *       { foo: <Foo input={input} />, bar: <Bar input={input} /> },
 *       { foo: <Foo />, bar: <Bar /> },
 *     ],
 *   }),
 * );
 */
export type DeepJSXElement<T> = T extends (infer Item)[]
  ? DeepJSXElement<Item>[]
  : T extends object
    ? { [K in keyof T]: DeepJSXElement<T[K]> }
    : T | JSX.Element;

// Allow children function to return plain objects that will be executed

export type ExecutableValue =
  | Element
  | Element[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents
  | Record<string, Element | any>;

export interface ToolCall {
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ChatResponse {
  content: string;
  tool_calls: ToolCall[];
}

// Component props as a type alias instead of interface
export type Args<P, O> = P & {
  children?:
    | ((output: O) => MaybePromise<ExecutableValue | Primitive>)
    // support child functions that do not return anything, but maybe do some other side effect
    | ((output: O) => void)
    | ((output: O) => Promise<void>);
};

export type GsxComponent<P, O> = (
  props: Args<P, O>,
) => MaybePromise<DeepJSXElement<O> | ExecutableValue>;

export { type GsxTool };

export type StreamResponse = string | { tool_call: ToolCall };

export type Streamable =
  | AsyncIterableIterator<StreamResponse>
  | IterableIterator<StreamResponse>;

export type ChatResult = Streamable | ChatResponse;

export type GsxStreamComponent<P, R = Streamable> = (
  props: StreamArgs<P>,
) => MaybePromise<DeepJSXElement<R> | ExecutableValue>;

// Stream component props as a type alias
export type StreamArgs<P> = P & {
  stream?: boolean;
  children?:
    | ((output: Streamable) => MaybePromise<ExecutableValue | Primitive>)
    | ((
        output: string,
      ) => MaybePromise<ExecutableValue | Primitive | undefined>)
    | ((
        output: string | Streamable,
      ) => MaybePromise<ExecutableValue | Primitive | undefined>)
    // support child functions that do not return anything, but maybe do some other side effect
    | ((output: string) => void)
    | ((output: Streamable) => void)
    | ((output: string) => Promise<void>)
    | ((output: Streamable) => Promise<void>);
};

export interface Context<T> {
  readonly __type: "Context";
  readonly defaultValue: T;
  readonly symbol: symbol;
  Provider: GsxComponent<{ value: T }, ExecutionContext>;
}
