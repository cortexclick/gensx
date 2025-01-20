import type {
  DeepJSXElement,
  GsxComponent,
  GsxStreamComponent,
  MaybePromise,
  Streamable,
} from "./types";

import { JSX } from "./jsx-runtime";
import { resolveDeep } from "./resolve";
import { getWorkflowContext } from "./workflow-context";

export function Component<P, O>(
  name: string,
  fn: (props: P) => MaybePromise<O | DeepJSXElement<O> | JSX.Element>,
): GsxComponent<P, O> {
  const GsxComponent: GsxComponent<P, O> = async props => {
    const workflowContext = getWorkflowContext();
    if (!workflowContext) {
      throw new Error(
        "No workflow context found. Components must be executed within a workflow context.",
      );
    }

    const { checkpointManager } = workflowContext;

    // Create checkpoint node for this component execution
    // only async due to dynamic import, but otherwise non-blocking
    const nodeId = await checkpointManager.addNode({
      componentName: name,
      props: Object.fromEntries(
        Object.entries(props).filter(([key]) => key !== "children"),
      ),
    });

    try {
      const result = await resolveDeep(fn(props));

      // Complete the checkpoint node with the result
      checkpointManager.completeNode(nodeId, result);

      return result;
    } catch (error) {
      // Record error in checkpoint
      if (error instanceof Error) {
        checkpointManager.addMetadata(nodeId, { error: error.message });
        checkpointManager.completeNode(nodeId, undefined);
      }
      throw error;
    }
  };

  if (name) {
    Object.defineProperty(GsxComponent, "name", {
      value: name,
    });
  }

  return GsxComponent;
}

export function StreamComponent<P>(
  name: string,
  fn: (props: P) => MaybePromise<Streamable | JSX.Element>,
): GsxStreamComponent<P> {
  const GsxStreamComponent: GsxStreamComponent<P> = async props => {
    const iterator: Streamable = await resolveDeep(fn(props));
    if (props.stream) {
      return iterator;
    }

    let result = "";
    for await (const token of iterator) {
      result += token;
    }
    return result;
  };

  if (name) {
    Object.defineProperty(GsxStreamComponent, "name", {
      value: name,
    });
  }

  const component = GsxStreamComponent;
  return component;
}
