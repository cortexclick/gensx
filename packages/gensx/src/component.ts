import type {
  ComponentProps,
  MaybePromise,
  Streamable,
  StreamComponentProps,
  StreamingComponent,
  WorkflowComponent,
  WorkflowContext,
} from "./types";

import { withContext } from "./context";
import { JSX } from "./jsx-runtime";
import { resolveDeep } from "./resolve";

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
 * interface ComponentProps {
 *   input: string;
 * }
 *
 * const Component = gsx.Component<ComponentProps, ComponentOutput>(
 *   ({ input }) => ({
 *     nested: [
 *       { foo: <Foo input={input} />, bar: <Bar input={input} /> },
 *       { foo: <Foo />, bar: <Bar /> },
 *     ],
 *   }),
 * );
 */
type DeepJSXElement<T> = T extends (infer Item)[]
  ? DeepJSXElement<Item>[]
  : T extends object
    ? { [K in keyof T]: DeepJSXElement<T[K]> }
    : T | JSX.Element;

export function Component<P, O>(
  fn: (
    props: P,
  ) => MaybePromise<
    | O
    | JSX.Element
    | JSX.Element[]
    | Record<string, JSX.Element>
    | DeepJSXElement<O>
    | undefined
  >,
): WorkflowComponent<P, O> {
  function GsxComponent(props: ComponentProps<P, O>): () => Promise<O> {
    return async () => {
      const result = await resolveDeep(fn(props));

      let finalResult: O;
      if (props.children) {
        finalResult = await withContext({}, () =>
          props.children?.(result as O),
        );
      } else {
        finalResult = result as O; // TODO: Extract type information from children.
      }
      return finalResult;
    };
  }

  if (fn.name) {
    Object.defineProperty(GsxComponent, "name", {
      value: `GsxComponent[${fn.name}]`,
    });
  }

  const component = GsxComponent;
  return component;
}

export function StreamComponent<P>(
  fn: (props: P) => MaybePromise<Streamable | JSX.Element | undefined>, // It does not make sense to stream from more than one child element
): StreamingComponent<P, boolean> {
  function GsxStreamComponent<Stream extends boolean = false>(
    props: StreamComponentProps<P, Stream>,
  ): () => Promise<Stream extends true ? Streamable : string> {
    return async () => {
      const iterator: Streamable = await resolveDeep(fn(props));
      if (props.stream) {
        if (props.children) {
          return withContext({}, () =>
            props.children?.(iterator as unknown as Streamable & string),
          );
        }
        return iterator as Stream extends true ? Streamable : string;
      }

      let result = "";
      for await (const token of iterator) {
        result += token;
      }
      if (props.children) {
        return withContext({}, () =>
          props.children?.(result as unknown as Streamable & string),
        );
      }
      return result as Stream extends true ? Streamable : string;
    };
  }

  if (fn.name) {
    Object.defineProperty(GsxStreamComponent, "name", {
      value: `GsxStreamComponent[${fn.name}]`,
    });
  }

  const component = GsxStreamComponent;
  return component;
}

export function ContextProvider<P, C extends Partial<WorkflowContext>>(
  fn: (props: P) => MaybePromise<C>,
): WorkflowComponent<P, never> {
  function GsxContextProvider(
    props: ComponentProps<P, never>,
  ): () => Promise<never> {
    return async () => {
      const context = await fn(props);
      const children = props.children;
      if (!children) {
        console.warn("Provider has no children");
        return null as never;
      }
      return withContext(context, () => children(null as never));
    };
  }

  if (fn.name) {
    Object.defineProperty(GsxContextProvider, "name", {
      value: `GsxContextProvider[${fn.name}]`,
    });
  }

  const component = GsxContextProvider;
  return component;
}
