import { readFileSync } from "fs";
import { setTimeout } from "timers/promises";

import type { ExecutionNode } from "@/checkpoint.js";

import { beforeEach, expect, suite, test, vi } from "vitest";

import { CheckpointManager } from "@/checkpoint.js";
import { gsx } from "@/index.js";

import {
  executeWithCheckpoints,
  getExecutionFromBody,
  mockFetch,
} from "./utils/executeWithCheckpoints";

// Helper function to generate test IDs
export function generateTestId(): string {
  return `test-${Math.random().toString(36).substring(7)}`;
}

suite("checkpoint", () => {
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
    process.env.GENSX_CHECKPOINTS = "false";

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

    // Restore checkpoints
    process.env.GENSX_CHECKPOINTS = undefined;

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
    const fetchCalls = vi.mocked(global.fetch).mock.calls.length;

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
    expect(finalCheckpoint.children.length).toBe(100);
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

    // For now, verify we have the right number of total nodes (1 parent + 3 children)
    function countNodes(node: ExecutionNode): number {
      return (
        1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
      );
    }
    expect(countNodes(finalCheckpoint)).toBe(4);
    expect(finalCheckpoint.children.length).toBe(3);
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

    // Verify checkpoint structure
    expect(finalCheckpoint).toMatchObject({
      componentName: "ParentComponent",
      children: [
        {
          componentName: "ComponentA",
          children: [],
          output: "a:first",
          props: { value: "first" },
        },
        {
          componentName: "ComponentB",
          output: "b:second",
          props: { value: "second" },
          children: [],
        },
      ],
      output: { a: "a:first", b: "b:second" },
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

  test("masks functions in checkpoints", async () => {
    const nativeFunction = readFileSync;
    const customFunction = () => "test";

    type CustomFn = () => string;
    type TimerFn = typeof setTimeout;

    const FunctionComponent = gsx.Component<
      {},
      { fn: CustomFn; native: TimerFn }
    >("FunctionComponent", () => ({
      fn: customFunction,
      native: nativeFunction,
    }));

    const { result, checkpoints } = await executeWithCheckpoints<{
      fn: CustomFn;
      native: TimerFn;
    }>(<FunctionComponent />);

    // Verify the actual result contains the functions
    expect(typeof result.fn).toBe("function");
    expect(typeof result.native).toBe("function");
    expect(result.fn()).toBe("test");

    // Verify the checkpoint masks the functions
    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    expect(finalCheckpoint.output).toEqual({
      fn: "[function]",
      native: "[function]",
    });
  });

  test("handles streaming components", async () => {
    // Define a streaming component that yields tokens with delays
    const StreamingComponent = gsx.StreamComponent<{ tokens: string[] }>(
      "StreamingComponent",
      ({ tokens }) => {
        const stream = async function* () {
          for (const token of tokens) {
            await setTimeout(0); // Small delay between tokens
            yield token;
          }
        };
        return stream();
      },
    );

    // Test non-streaming mode first
    const { result: nonStreamingResult, checkpoints: nonStreamingCheckpoints } =
      await executeWithCheckpoints<string>(
        <StreamingComponent tokens={["Hello", " ", "World"]} stream={false} />,
      );

    // Verify non-streaming execution
    expect(nonStreamingResult).toBe("Hello World");
    const nonStreamingFinal =
      nonStreamingCheckpoints[nonStreamingCheckpoints.length - 1];
    expect(nonStreamingFinal).toMatchObject({
      componentName: "StreamingComponent",
      props: { tokens: ["Hello", " ", "World"] },
      output: "Hello World",
    });

    // Test streaming mode
    const {
      result: streamingResult,
      checkpoints: streamingCheckpoints,
      checkpointManager,
    } = await executeWithCheckpoints<AsyncGenerator<string>>(
      <StreamingComponent tokens={["Hello", " ", "World"]} stream={true} />,
    );

    // Collect streaming results
    let streamedContent = "";
    for await (const token of streamingResult) {
      streamedContent += token;
    }

    // Wait for final checkpoint to be written
    await checkpointManager.waitForPendingUpdates();

    // Verify streaming execution
    expect(streamedContent).toBe("Hello World");
    const streamingFinal =
      streamingCheckpoints[streamingCheckpoints.length - 1];
    expect(streamingFinal).toMatchObject({
      componentName: "StreamingComponent",
      props: { tokens: ["Hello", " ", "World"] },
      output: "Hello World",
      metadata: { streamCompleted: true },
    });
  });

  test("handles errors in streaming components", async () => {
    const ErrorStreamingComponent = gsx.StreamComponent<{
      shouldError: boolean;
    }>("ErrorStreamingComponent", ({ shouldError }) => {
      const stream = async function* () {
        yield "start";
        await setTimeout(0); // Add delay to ensure async behavior
        if (shouldError) {
          throw new Error("Stream error");
        }
        yield "end";
      };
      return stream();
    });

    // Execute with error
    const {
      result: errorResult,
      checkpoints: errorCheckpoints,
      checkpointManager,
    } = await executeWithCheckpoints<AsyncGenerator<string>>(
      <ErrorStreamingComponent shouldError={true} stream={true} />,
    );

    // Collect results until error
    let errorContent = "";
    try {
      for await (const token of errorResult) {
        errorContent += token;
      }
    } catch (_error) {
      // Expected error, ignore
    }

    // Wait for final checkpoint to be written
    await checkpointManager.waitForPendingUpdates();

    // Verify error state
    expect(errorContent).toBe("start");
    const errorFinal = errorCheckpoints[errorCheckpoints.length - 1];
    expect(errorFinal).toMatchObject({
      componentName: "ErrorStreamingComponent",
      output: "start",
      metadata: {
        error: "Stream error",
        streamCompleted: false,
      },
    });
  });
});

suite("tree reconstruction", () => {
  beforeEach(() => {
    mockFetch(() => {
      return new Response(null, { status: 200 });
    });
  });

  test("handles simple parent-child relationship", async () => {
    const cm = new CheckpointManager({
      apiKey: "test-api-key",
      org: "test-org",
    });
    const parentId = generateTestId();
    const childId = cm.addNode({ componentName: "Child1" }, parentId);
    cm.addNode({ componentName: "Parent", id: parentId });

    await cm.waitForPendingUpdates();

    // Verify fetch was called with the correct tree structure
    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalled();
    const lastCall = fetchMock.mock.lastCall;
    expect(lastCall).toBeDefined();
    const options = lastCall![1];
    expect(options?.body).toBeDefined();
    const lastCallBody = getExecutionFromBody(options?.body as string);
    expect(lastCallBody.componentName).toBe("Parent");
    expect(lastCallBody.children[0].componentName).toBe("Child1");

    // Verify tree structure
    expect(cm.root?.componentName).toBe("Parent");
    expect(cm.root?.children).toHaveLength(1);
    expect(cm.root?.children[0].componentName).toBe("Child1");
    expect(cm.root?.children[0].id).toBe(childId);
  });

  test("handles multiple children waiting for same parent", () => {
    const cm = new CheckpointManager();
    const parentId = generateTestId();
    cm.addNode({ componentName: "Child2A" }, parentId);
    cm.addNode({ componentName: "Child2B" }, parentId);
    cm.addNode({ componentName: "Parent2", id: parentId });

    expect(cm.root?.componentName).toBe("Parent2");
    expect(cm.root?.children).toHaveLength(2);
    expect(cm.root?.children.map((c) => c.componentName)).toContain("Child2A");
    expect(cm.root?.children.map((c) => c.componentName)).toContain("Child2B");
  });

  test("handles deep tree with mixed ordering", () => {
    const cm = new CheckpointManager();
    const rootId = generateTestId();
    const branchAId = generateTestId();
    const branchBId = generateTestId();

    cm.addNode({ componentName: "LeafA" }, branchAId);
    cm.addNode({ componentName: "LeafB" }, branchBId);
    cm.addNode({ componentName: "Root", id: rootId });
    cm.addNode({ componentName: "BranchA", id: branchAId }, rootId);
    cm.addNode({ componentName: "BranchB", id: branchBId }, rootId);

    const root = cm.root;
    expect(root?.componentName).toBe("Root");
    expect(root?.children).toHaveLength(2);

    const branchA = root?.children.find((c) => c.componentName === "BranchA");
    const branchB = root?.children.find((c) => c.componentName === "BranchB");

    expect(branchA?.children[0].componentName).toBe("LeafA");
    expect(branchB?.children[0].componentName).toBe("LeafB");
  });

  test("handles root node arriving after children", () => {
    const cm = new CheckpointManager();
    const rootId = generateTestId();
    const childId = cm.addNode({ componentName: "Child" }, rootId);
    cm.addNode({ componentName: "Grandchild" }, childId);
    cm.addNode({ componentName: "Root", id: rootId });

    expect(cm.root?.componentName).toBe("Root");
    expect(cm.root?.children[0].componentName).toBe("Child");
    expect(cm.root?.children[0].children[0].componentName).toBe("Grandchild");
  });

  test("handles complex reordering with multiple levels", () => {
    const cm = new CheckpointManager();
    const rootId = generateTestId();
    const branchAId = generateTestId();
    const branchBId = generateTestId();

    cm.addNode({ componentName: "LeafA" }, branchAId);
    cm.addNode({ componentName: "LeafB" }, branchBId);
    cm.addNode({ componentName: "LeafC" }, branchAId);

    cm.addNode({ componentName: "BranchB", id: branchBId }, rootId);
    cm.addNode({ componentName: "Root", id: rootId });
    cm.addNode({ componentName: "BranchA", id: branchAId }, rootId);

    const root = cm.root;
    expect(root?.componentName).toBe("Root");
    expect(root?.children).toHaveLength(2);

    const branchA = root?.children.find((c) => c.componentName === "BranchA");
    const branchB = root?.children.find((c) => c.componentName === "BranchB");

    // Verify all nodes are connected properly
    expect(branchA?.children.map((c) => c.componentName)).toContain("LeafA");
    expect(branchA?.children.map((c) => c.componentName)).toContain("LeafC");
    expect(branchB?.children.map((c) => c.componentName)).toContain("LeafB");

    // Verify tree integrity - every node should have correct parent reference
    function verifyNodeParentRefs(node: ExecutionNode) {
      for (const child of node.children) {
        expect(child.parentId).toBe(node.id);
        verifyNodeParentRefs(child);
      }
    }
    verifyNodeParentRefs(root!);
  });
});
