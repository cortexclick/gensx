/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { resolveDeep } from "./resolve";
import { MaybePromise } from "./types";

export namespace JSX {
  export type ElementType = (props: any) => Element;
  export type Element = () => Promise<unknown>;
  export interface ElementChildrenAttribute {
    children: (
      output: unknown,
    ) => JSX.Element | JSX.Element[] | Record<string, JSX.Element>;
  }
}

export const Fragment = (props: {
  children: JSX.Element[] | JSX.Element;
}): JSX.Element[] => {
  if (Array.isArray(props.children)) {
    return props.children;
  }
  return [props.children];
};

export const jsx = <
  TOutput,
  TProps extends Record<string, unknown> & {
    children?:
      | ((output: TOutput) => MaybePromise<JSX.Element | JSX.Element[]>)
      | JSX.Element
      | JSX.Element[];
  },
>(
  component: (props: TProps, elementName?: string) => MaybePromise<TOutput>,
  props: TProps | null,
  elementName?: string,
): (() => Promise<Awaited<TOutput> | Awaited<TOutput>[]>) => {
  // Return a promise that will be handled by execute()
  async function JsxWrapper(): Promise<Awaited<TOutput> | Awaited<TOutput>[]> {
    // Execute component with props and elementName as separate parameters
    const baseProps = props ?? ({} as TProps);
    console.log("elementName", elementName);

    // Execute component with elementName as second parameter
    const rawResult = await component(baseProps, elementName);

    // For non-streaming results, resolve deeply but preserve streamables
    const result = await resolveDeep(rawResult);

    // Don't need to worry about children here, we execute children inside the component wrappers.
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
