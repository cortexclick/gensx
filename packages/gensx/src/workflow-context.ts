import { CheckpointManager } from "./checkpoint";
import { getCurrentContext } from "./context";

// Static symbol for workflow context
export const WORKFLOW_CONTEXT_SYMBOL = Symbol.for("gensx.workflow");

export interface WorkflowExecutionContext {
  checkpointManager: CheckpointManager;
  // Future: Add more workflow-level utilities here
}

export function createWorkflowContext(): WorkflowExecutionContext {
  return {
    checkpointManager: new CheckpointManager(),
  };
}

export function getWorkflowContext(): WorkflowExecutionContext | undefined {
  const context = getCurrentContext();
  return context.getWorkflowContext();
}
