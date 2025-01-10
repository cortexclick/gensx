import type {
  ComponentProps,
  MaybePromise,
  Streamable,
  StreamComponentProps,
  StreamingComponent,
  WorkflowComponent,
} from "./types";

import { JSX } from "./jsx-runtime";
import { resolveDeep } from "./resolve";

// TODO: We execute the children inside the component wrappers in order to execute the children within the correct context.
// This also requires that the Component/StreamComponent/ContextProvider wrappers return functions, instead of just the promises.
// It's not the cleanest thing, and we might be able to simplify this if we migrate to AsyncLocalStorage for context instead.

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
        finalResult = await resolveDeep(props.children(result as O));
      } else {
        finalResult = result as O;
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
  fn: (props: P) => MaybePromise<Streamable | JSX.Element>,
): StreamingComponent<P, boolean> {
  function GsxStreamComponent<Stream extends boolean = false>(
    props: StreamComponentProps<P, Stream>,
  ): () => Promise<Stream extends true ? Streamable : string> {
    return async () => {
      const iterator: Streamable = await resolveDeep(fn(props));
      if (props.stream) {
        if (props.children) {
          return await resolveDeep(
            props.children(iterator as unknown as Streamable & string),
          );
        }
        return iterator as Stream extends true ? Streamable : string;
      }

      let result = "";
      for await (const token of iterator) {
        result += token;
      }
      if (props.children) {
        return await resolveDeep(
          props.children(result as unknown as Streamable & string),
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
