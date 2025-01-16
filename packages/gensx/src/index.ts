export { createContext, useContext } from "./context";
export { execute } from "./resolve";
export { Fragment, jsx, jsxs } from "./jsx-runtime";
export type { JSX } from "./jsx-runtime";
export { StreamComponent, Component } from "./component";
export type {
  Args,
  Context,
  MaybePromise,
  Streamable,
  StreamArgs,
  GsxStreamComponent,
  GsxComponent,
} from "./types";

import { Component, StreamComponent } from "./component";
import { createContext, useContext } from "./context";
import { execute } from "./resolve";
import * as types from "./types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace gsx {
  export type Args<P, O> = types.Args<P, O>;
  export type StreamArgs<P> = types.StreamArgs<P>;
}

export const gsx = {
  StreamComponent,
  Component,
  createContext,
  execute,
  useContext,
};
