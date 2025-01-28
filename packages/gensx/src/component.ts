import type {
  DeepJSXElement,
  ExecutableValue,
  GsxComponent,
  GsxStreamComponent,
  MaybePromise,
  Streamable,
} from "./types";

import { getCurrentContext } from "./context";
import { JSX } from "./jsx-runtime";
import { resolveDeep } from "./resolve";

export function Component<P, O>(
  name: string,
  fn: (props: P) => MaybePromise<O | DeepJSXElement<O> | JSX.Element>,
): GsxComponent<P, O> {
  const GsxComponent: GsxComponent<P, O> = async props => {
    const context = getCurrentContext();
    const workflowContext = context.getWorkflowContext();
    const { checkpointManager } = workflowContext;

    // Create checkpoint node for this component execution
    const nodeId = checkpointManager.addNode(
      {
        componentName: name,
        props: Object.fromEntries(
          Object.entries(props).filter(([key]) => key !== "children"),
        ),
      },
      context.getCurrentNodeId(),
    );

    try {
      const result = await context.withCurrentNode(nodeId, () =>
        resolveDeep(fn(props)),
      );

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

export function StreamComponent<P, R = Streamable>(
  name: string,
  fn: (props: P) => MaybePromise<DeepJSXElement<R> | ExecutableValue>,
): GsxStreamComponent<P, R> {
  const GsxStreamComponent: GsxStreamComponent<P, R> = async props => {
    const context = getCurrentContext();
    const workflowContext = context.getWorkflowContext();
    const { checkpointManager } = workflowContext;

    // Create checkpoint node for this component execution
    const nodeId = checkpointManager.addNode(
      {
        componentName: name,
        props: Object.fromEntries(
          Object.entries(props).filter(([key]) => key !== "children"),
        ),
      },
      context.getCurrentNodeId(),
    );

    try {
      const output = await context.withCurrentNode(nodeId, () =>
        resolveDeep(fn(props)),
      );

      // Handle non-iterable results (like ChatResponse)
      if (!output || !isAsyncIterable(output)) {
        checkpointManager.completeNode(nodeId, output);
        return output;
      }

      const iterator = output as Streamable;

      if (props.stream) {
        // Mark as streaming immediately
        checkpointManager.completeNode(nodeId, "[streaming in progress]");

        // Create a wrapper iterator that captures the output while streaming
        const wrappedIterator = async function* () {
          let accumulated = "";
          try {
            for await (const token of iterator) {
              if (typeof token === "string") {
                accumulated += token;
              } else {
                accumulated = JSON.stringify(token);
              }
              yield token;
            }
            // Update with final content if stream completes
            checkpointManager.updateNode(nodeId, {
              output: accumulated,
              metadata: { streamCompleted: true },
            });
          } catch (error) {
            if (error instanceof Error) {
              checkpointManager.updateNode(nodeId, {
                output: accumulated,
                metadata: {
                  error: error.message,
                  streamCompleted: false,
                },
              });
            }
            throw error;
          }
        };
        return wrappedIterator();
      }

      // Non-streaming case - accumulate all output then checkpoint
      let accumulated = "";
      for await (const token of iterator) {
        if (typeof token === "string") {
          accumulated += token;
        } else {
          accumulated = JSON.stringify(token);
        }
      }
      checkpointManager.completeNode(nodeId, accumulated);
      return accumulated;
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
    Object.defineProperty(GsxStreamComponent, "name", {
      value: name,
    });
  }

  const component = GsxStreamComponent;
  return component;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === "object" && value !== null && Symbol.asyncIterator in value
  );
}
