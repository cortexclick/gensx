import type {
  ComponentProps,
  MaybePromise,
  Streamable,
  StreamComponent,
  StreamComponentProps,
  WorkflowComponent,
} from "./types";

import { withContext } from "./context";
import { JSX } from "./jsx-runtime";

export function Component<P, O>(
  fn: (props: P) => MaybePromise<O | JSX.Element | JSX.Element[]>,
): WorkflowComponent<P, O> {
  function WorkflowFunction(props: ComponentProps<P, O>): MaybePromise<O> {
    return Promise.resolve(fn(props)) as Promise<O>;
  }

  if (fn.name) {
    Object.defineProperty(WorkflowFunction, "name", {
      value: `WorkflowFunction[${fn.name}]`,
    });
  }

  // Mark as workflow component and JSX element type
  const component = WorkflowFunction as WorkflowComponent<P, O>;
  component.isWorkflowComponent = true;

  return component;
}

export function StreamComponent<P, O>(
  fn: (props: P) => MaybePromise<Streamable<O>>,
): StreamComponent<P, O> {
  function StreamWorkflowFunction(
    props: StreamComponentProps<P, O>,
  ): MaybePromise<Streamable<O>> {
    return withContext({ streaming: props.stream ?? false }, async () =>
      Promise.resolve(fn(props)),
    );
  }

  if (fn.name) {
    Object.defineProperty(StreamWorkflowFunction, "name", {
      value: `StreamWorkflowFunction[${fn.name}]`,
    });
  }

  // Mark as stream component
  const component = StreamWorkflowFunction as StreamComponent<P, O>;
  component.isStreamComponent = true;

  return component;
}
