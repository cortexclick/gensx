/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ExecutionContext, withContext } from "./context";
import { resolveDeep } from "./resolve";
import {
  Args,
  ExecutableValue,
  MaybePromise,
  Primitive,
  StreamArgs,
} from "./types";

export namespace JSX {
  export type ElementType = Element;
  export type Element = (props: Args<any, unknown>) => MaybePromise<unknown>;
  export interface ElementChildrenAttribute {
    children: (
      output: unknown,
    ) => JSX.Element | JSX.Element[] | Record<string, JSX.Element>;
  }
}

export const Fragment = (props: { children?: JSX.Element[] | JSX.Element }) => {
  if (!props.children) {
    return [];
  }
  if (Array.isArray(props.children)) {
    return props.children;
  }
  return [props.children];
};

(Fragment as any).__gsxFragment = true;

export const jsx = <TOutput, TProps>(
  component: (
    props: Args<TProps, TOutput> | StreamArgs<TProps>,
  ) => MaybePromise<TOutput>,
  fullProps: Args<TProps, TOutput> | null,
): (() => Promise<Awaited<TOutput> | Awaited<TOutput>[]>) => {
  // Only set name if children is a function and doesn't already have our naming pattern
  if (
    fullProps?.children &&
    typeof fullProps.children === "function" &&
    fullProps.children.name &&
    !fullProps.children.name.startsWith("Children[")
  ) {
    Object.defineProperty(fullProps.children, "name", {
      value: `Children[${component.name}]`,
    });
  }

  // Return a promise that will be handled by execute()
  async function JsxWrapper(): Promise<Awaited<TOutput> | Awaited<TOutput>[]> {
    const { children, ...props } = fullProps ?? ({} as Args<TProps, TOutput>);
    const rawResult = await component(props as Args<TProps, TOutput>);
    const result = await resolveDeep(rawResult);

    // Need to special case Fragment, because it's children are actually executed in the resolveDeep above
    if (children && !(component as any).__gsxFragment) {
      if (result instanceof ExecutionContext) {
        return await withContext(result, async () => {
          const childResult = await resolveChildren(null as never, children);
          const resolvedChildResult = await resolveDeep(childResult);
          return resolvedChildResult as Awaited<TOutput> | Awaited<TOutput>[];
        });
      } else {
        const childResult = await resolveChildren(result as TOutput, children);
        const resolvedChildResult = await resolveDeep(childResult);
        return resolvedChildResult as Awaited<TOutput> | Awaited<TOutput>[];
      }
    }
    return result as Awaited<TOutput> | Awaited<TOutput>[];
  }

  if (component.name) {
    Object.defineProperty(JsxWrapper, "name", {
      value: `JsxWrapper[${component.name}]`,
    });
  }

  return JsxWrapper;
};

export const jsxs = jsx;

function resolveChildren<O>(
  output: O,
  children:
    | JSX.Element
    | JSX.Element[]
    | ((output: O) => MaybePromise<ExecutableValue | Primitive>)
    | ((output: O) => void)
    | ((output: O) => Promise<void>),
): MaybePromise<unknown> {
  if (typeof children === "function") {
    return children(output);
  }
  if (Array.isArray(children)) {
    return Promise.all(children.map(child => child(output)));
  }
  // Single element case
  return (children as JSX.Element)(output);
}
