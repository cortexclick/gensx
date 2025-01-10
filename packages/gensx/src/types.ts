import { JSX } from "./jsx-runtime";

export type MaybePromise<T> = T | Promise<T>;

export type Element = JSX.Element;

export interface OutputProps {
  output?: string;
}

export type Primitive = string | number | boolean | null | undefined;

// Base props type without children
type BaseProps<P> = P & OutputProps;

// Make components valid JSX elements
export type WorkflowComponent<P, O> = (
  props: ComponentProps<P, O>,
) => () => Promise<O>;

// Allow children function to return plain objects that will be executed

export type ExecutableValue =
  | Element
  | Element[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents
  | Record<string, Element | any>;

// Component props as a type alias instead of interface
export type ComponentProps<P, O> = BaseProps<P> & {
  children?:
    | ((output: O) => MaybePromise<ExecutableValue | Primitive>)
    // support child functions that do not return anything, but maybe do some other side effect
    | ((output: O) => void)
    | ((output: O) => Promise<void>);
};

export type Streamable =
  | AsyncIterableIterator<string>
  | IterableIterator<string>;

// Stream component props as a type alias
export type StreamComponentProps<
  P,
  Stream extends boolean | undefined,
> = BaseProps<P> & {
  stream?: Stream;
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

export type StreamingComponent<P, Stream extends boolean | undefined> = (
  props: StreamComponentProps<P, Stream>,
) => () => Promise<Stream extends true ? Streamable : string>;

export interface Context<T> {
  readonly __type: "Context";
  readonly defaultValue: T;
  readonly symbol: symbol;
  Provider: WorkflowComponent<{ value: T }, never>;
}
