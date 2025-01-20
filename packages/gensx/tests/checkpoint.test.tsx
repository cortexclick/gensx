import { setTimeout } from "timers/promises";

import type { ExecutionNode } from "@/checkpoint.js";
import type { ExecutableValue } from "@/types.js";

import { afterEach, beforeEach, expect, suite, test, vi } from "vitest";

import { CheckpointManager } from "@/checkpoint.js";
import { ExecutionContext, withContext } from "@/context.js";
import { gsx } from "@/index.js";
import { createWorkflowContext } from "@/workflow-context.js";

// Add types for fetch API
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/**
 * Helper to execute a workflow with checkpoint tracking
 * Returns both the execution result and recorded checkpoints for verification
 */

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
async function executeWithCheckpoints<T>(
  element: ExecutableValue,
): Promise<{ result: T; checkpoints: ExecutionNode[] }> {
  const checkpoints: ExecutionNode[] = [];

  // Set up fetch mock to capture checkpoints
  global.fetch = vi
    .fn()
    // eslint-disable-next-line @typescript-eslint/require-await
    .mockImplementation(async (_input: FetchInput, options?: FetchInit) => {
      if (!options?.body) throw new Error("No body provided");
      const checkpoint = JSON.parse(options.body as string) as ExecutionNode;
      checkpoints.push(checkpoint);
      return new Response(null, { status: 200 });
    });

  // Create and configure workflow context
  const checkpointManager = new CheckpointManager();
  const workflowContext = createWorkflowContext();
  workflowContext.checkpointManager = checkpointManager;
  const executionContext = new ExecutionContext({});
  const contextWithWorkflow = executionContext.withContext({
    [Symbol.for("gensx.workflow")]: workflowContext,
  });

  // Execute with context
  const result = await withContext(contextWithWorkflow, () =>
    gsx.execute<T>(element),
  );

  return { result, checkpoints };
}

suite("checkpoint", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.GENSX_CHECKPOINTS;

  beforeEach(() => {
    process.env.GENSX_CHECKPOINTS = "true";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GENSX_CHECKPOINTS = originalEnv;
    vi.restoreAllMocks();
  });

  test("basic component test", async () => {
    // Define a simple component that returns a string
    const SimpleComponent = gsx.Component<{ message: string }, string>(
      "SimpleComponent",
      async ({ message }) => {
        await setTimeout(0); // Add small delay like other tests
        return `hello ${message}`;
      },
    );

    // Execute workflow and get results
    const { result, checkpoints } = await executeWithCheckpoints<string>(
      <SimpleComponent message="world" />,
    );

    // Verify execution result
    expect(result).toBe("hello world");

    // Verify checkpoint calls were made
    expect(global.fetch).toHaveBeenCalled();

    // Get final checkpoint state
    const finalCheckpoint = checkpoints[checkpoints.length - 1];

    // Verify checkpoint structure
    expect(finalCheckpoint).toMatchObject({
      componentName: "SimpleComponent",
      props: { message: "world" },
      output: "hello world",
    });

    // Verify timing fields
    expect(finalCheckpoint.startTime).toBeDefined();
    expect(finalCheckpoint.endTime).toBeDefined();
    expect(finalCheckpoint.startTime).toBeLessThan(finalCheckpoint.endTime!);
  });

  test("no checkpoints when disabled", async () => {
    // Disable checkpoints
    process.env.GENSX_CHECKPOINTS = undefined;

    // Define a simple component that returns a string
    const SimpleComponent = gsx.Component<{ message: string }, string>(
      "SimpleComponent",
      async ({ message }) => {
        await setTimeout(0);
        return `hello ${message}`;
      },
    );

    // Execute workflow and get results
    const { result, checkpoints } = await executeWithCheckpoints<string>(
      <SimpleComponent message="world" />,
    );

    // Verify execution still works
    expect(result).toBe("hello world");

    // Verify no checkpoint calls were made
    expect(global.fetch).not.toHaveBeenCalled();
    expect(checkpoints).toHaveLength(0);
  });

  test("handles parallel execution", async () => {
    // Define a simple component that we'll use many times
    const SimpleComponent = gsx.Component<{ id: number }, string>(
      "SimpleComponent",
      async ({ id }) => {
        await setTimeout(0); // Small delay to ensure parallel execution
        return `component ${id}`;
      },
    );

    // Create a component that returns an array of parallel executions
    const ParallelComponent = gsx.Component<{}, string[]>(
      "ParallelComponent",
      async () => {
        return Promise.all(
          Array.from({ length: 100 }).map((_, i) =>
            gsx.execute<string>(<SimpleComponent id={i} />),
          ),
        );
      },
    );

    // Execute workflow and get results
    const { result, checkpoints } = await executeWithCheckpoints<string[]>(
      <ParallelComponent />,
    );

    // Verify execution result
    expect(result).toHaveLength(100);
    expect(result[0]).toBe("component 0");
    expect(result[99]).toBe("component 99");

    // Verify checkpoint behavior
    const fetchCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mock.calls.length;

    // We expect:
    // - Some minimum number of calls to capture the state (could be heavily batched)
    // - Less than the theoretical maximum (303 = parent(2) + children(200) + execute calls(101))
    // - Evidence of queueing (significantly less than theoretical maximum)
    expect(fetchCalls).toBeGreaterThan(0); // At least some calls must happen
    expect(fetchCalls).toBeLessThan(303); // Less than theoretical maximum
    expect(fetchCalls).toBeLessThan(250); // Evidence of significant queueing

    // Verify we have all nodes
    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    expect(finalCheckpoint.componentName).toBe("ParallelComponent");

    function countNodes(node: ExecutionNode): number {
      return (
        1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
      );
    }
    expect(countNodes(finalCheckpoint)).toBe(101);
  });

  test("handles sequential execute calls within component", async () => {
    // Define a simple component that we'll use multiple times
    const SimpleComponent = gsx.Component<{ id: number }, string>(
      "SimpleComponent",
      async ({ id }) => {
        await setTimeout(0);
        return `component ${id}`;
      },
    );

    // Create a component that makes three sequential execute calls
    const ParentComponent = gsx.Component<{}, string>(
      "ParentComponent",
      async () => {
        const first = await gsx.execute<string>(<SimpleComponent id={1} />);
        const second = await gsx.execute<string>(<SimpleComponent id={2} />);
        const third = await gsx.execute<string>(<SimpleComponent id={3} />);
        return `${first}, ${second}, ${third}`;
      },
    );

    // Execute workflow and get results
    const { result, checkpoints } = await executeWithCheckpoints<string>(
      <ParentComponent />,
    );

    // Verify execution result
    expect(result).toBe("component 1, component 2, component 3");

    // Get final checkpoint state
    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    expect(finalCheckpoint.componentName).toBe("ParentComponent");

    // TODO: Update gsx.execute to maintain proper parent context for sequential execution.
    // Currently each execute() call creates a new nested node instead of appearing as
    // a sibling in the parent's children array. This creates deeper nesting than desired
    // and makes the execution tree harder to understand.

    // For now, verify we have the right number of total nodes (1 parent + 3 children)
    function countNodes(node: ExecutionNode): number {
      return (
        1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
      );
    }
    expect(countNodes(finalCheckpoint)).toBe(4);
  });

  test("handles component children with object return", async () => {
    // Define child components
    const ComponentA = gsx.Component<{ value: string }, string>(
      "ComponentA",
      async ({ value }) => {
        await setTimeout(0);
        return `a:${value}`;
      },
    );

    const ComponentB = gsx.Component<{ value: string }, string>(
      "ComponentB",
      async ({ value }) => {
        await setTimeout(0);
        return `b:${value}`;
      },
    );

    // Create parent component that returns an object with multiple children
    const ParentComponent = gsx.Component<{}, { a: string; b: string }>(
      "ParentComponent",
      () => {
        return {
          a: <ComponentA value="first" />,
          b: <ComponentB value="second" />,
        };
      },
    );

    // Execute workflow and get results
    const { result, checkpoints } = await executeWithCheckpoints<{
      a: string;
      b: string;
    }>(<ParentComponent />);

    // Verify execution result
    expect(result).toEqual({
      a: "a:first",
      b: "b:second",
    });

    // Get final checkpoint state
    const finalCheckpoint = checkpoints[checkpoints.length - 1];

    // TODO: this is not the parenting we would expect. We need to deterministically plumb in the parent context and remove the global currentNode context.

    // Verify checkpoint structure
    expect(finalCheckpoint).toMatchObject({
      componentName: "ParentComponent",
      children: [
        {
          componentName: "ComponentA",
          children: [
            {
              componentName: "ComponentB",
              output: "b:second",
              props: { value: "second" },
            },
          ],
          output: "a:first",
          props: { value: "first" },
        },
      ],
    });
  });

  test("handles nested component hierarchy", async () => {
    // Define components that will be nested
    const ComponentC = gsx.Component<{ value: string }, string>(
      "ComponentC",
      async ({ value }) => {
        await setTimeout(0);
        return `c:${value}`;
      },
    );

    const ComponentB = gsx.Component<{ value: string }, string>(
      "ComponentB",
      async ({ value }) => {
        const inner = await gsx.execute<string>(
          <ComponentC value={`${value}-inner`} />,
        );
        return `b:${value}(${inner})`;
      },
    );

    const ComponentA = gsx.Component<{ value: string }, string>(
      "ComponentA",
      async ({ value }) => {
        const middle = await gsx.execute<string>(
          <ComponentB value={`${value}-middle`} />,
        );
        return `a:${value}(${middle})`;
      },
    );

    // Execute workflow and get results
    const { result, checkpoints } = await executeWithCheckpoints<string>(
      <ComponentA value="outer" />,
    );

    // Verify execution result
    expect(result).toBe("a:outer(b:outer-middle(c:outer-middle-inner))");

    // Get final checkpoint state
    const finalCheckpoint = checkpoints[checkpoints.length - 1];

    // Verify checkpoint structure shows proper nesting
    expect(finalCheckpoint).toMatchObject({
      componentName: "ComponentA",
      props: { value: "outer" },
      output: "a:outer(b:outer-middle(c:outer-middle-inner))",
      children: [
        {
          componentName: "ComponentB",
          props: { value: "outer-middle" },
          output: "b:outer-middle(c:outer-middle-inner)",
          children: [
            {
              componentName: "ComponentC",
              props: { value: "outer-middle-inner" },
              output: "c:outer-middle-inner",
            },
          ],
        },
      ],
    });
  });
});
