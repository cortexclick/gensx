import { expect, test } from "vitest";

import { gsx } from "../src";

interface NumberWrapperOutput {
  value: number;
}

const NumberWrapper = gsx.Component<{ n: number }, NumberWrapperOutput>(
  "NumberWrapper",
  ({ n }) => ({ value: n }),
);

const NumberDoubler = gsx.Component<{ value: number }, number>(
  "NumberDoubler",
  ({ value }) => value * 2,
);

const AsyncNumberFilter = gsx.Component<{ value: number }, boolean>(
  "AsyncNumberFilter",
  async ({ value }) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return value > 5;
  },
);

const Value = gsx.Component<{ value: number | boolean }, number | boolean>(
  "Value",
  ({ value }) => value,
);

const TaskGenerator = gsx.Component<{ value: number }, number[]>(
  "TaskGenerator",
  async ({ value }) => {
    // Simulate a workflow step that generates multiple tasks
    await new Promise((resolve) => setTimeout(resolve, 1));
    // For each input, generate [value, value*2] as sub-tasks
    return [value, <NumberDoubler value={value} />];
  },
);

const BatchProcessor = gsx.Component<{ inputs: number[] }, number>(
  "BatchProcessor",
  async ({ inputs }) => {
    // Create a new array workflow inside the component
    const results = await gsx
      .array<NumberWrapperOutput>(inputs.map((n) => <NumberWrapper n={n} />))
      .map<number>((n) => <NumberDoubler value={n.value} />)
      .filter((n) => <AsyncNumberFilter value={n} />)
      .reduce((acc: number, n: number) => <Value value={acc + n} />, 0);

    return results;
  },
);

const ArrayProvider = gsx.Component<{ inputs: number[] }, number[]>(
  "ArrayProvider",
  ({ inputs }) => inputs,
);

test("map transforms array elements", async () => {
  const arr = gsx.array<NumberWrapperOutput>([
    <NumberWrapper n={1} />,
    <NumberWrapper n={2} />,
    <NumberWrapper n={3} />,
  ]);
  const result = await arr
    .map((n) => <NumberDoubler value={n.value} />)
    .toArray();

  expect(result).toEqual([2, 4, 6]);
});

test("filter removes elements based on predicate", async () => {
  const arr = gsx.array<NumberWrapperOutput>([
    <NumberWrapper n={1} />,
    <NumberWrapper n={2} />,
    <NumberWrapper n={3} />,
    <NumberWrapper n={4} />,
    <NumberWrapper n={5} />,
    <NumberWrapper n={6} />,
  ]);
  const result = await arr
    .filter((n) => <AsyncNumberFilter value={n.value} />)
    .toArray();

  expect(result).toEqual([{ value: 6 }]);
});

test("reduce accumulates results", async () => {
  const arr = gsx.array<NumberWrapperOutput>([
    <NumberWrapper n={1} />,
    <NumberWrapper n={2} />,
    <NumberWrapper n={3} />,
  ]);
  const result = await arr
    .map<number>((n) => <NumberDoubler value={n.value} />)
    .map<number>((n) => <Value value={n} />)
    .reduce((acc: number, n: number) => <Value value={acc + n} />, 0);

  expect(result).toEqual(12); // (1*2 + 2*2 + 3*2)
});

test("chains multiple operations", async () => {
  const arr = gsx.array<NumberWrapperOutput>([
    <NumberWrapper n={1} />,
    <NumberWrapper n={2} />,
    <NumberWrapper n={3} />,
    <NumberWrapper n={4} />,
    <NumberWrapper n={5} />,
  ]);
  const result = await arr
    .map<number>((n) => <NumberDoubler value={n.value} />)
    .map<number>((n) => <Value value={n} />)
    .filter((n: number) => <AsyncNumberFilter value={n} />)
    .reduce<number>((acc: number, n: number) => <Value value={acc + n} />, 0);

  expect(result).toEqual(24); // (6 + 8 + 10) where all values > 5 are kept
});

test("flatMap generates multiple tasks from each input, task generator returns nested components", async () => {
  const arr = gsx.array<NumberWrapperOutput>([
    <NumberWrapper n={1} />,
    <NumberWrapper n={2} />,
  ]);

  const result = await arr
    .flatMap((n) => <TaskGenerator value={n.value} />)
    .toArray();

  // Each input n generates [n, n*2]
  // So input [1, 2] becomes [1, 2, 2, 4]
  expect(result).toEqual([1, 2, 2, 4]);
});

test("components can use gsx.array internally for workflow composition", async () => {
  const result = await gsx.execute(<BatchProcessor inputs={[1, 2, 3, 4, 5]} />);

  // Only values that double to > 5 are kept (6, 8, 10)
  expect(result).toEqual(24);
});

test("can use gsx.array operations in child functions", async () => {
  const result = await gsx.execute(
    <ArrayProvider inputs={[1, 2, 3, 4, 5]}>
      {(numbers: number[]) =>
        gsx
          .array<NumberWrapperOutput>(
            numbers.map((n) => <NumberWrapper n={n} />),
          )
          .map<number>((n) => <NumberDoubler value={n.value} />)
          .filter((n) => <AsyncNumberFilter value={n} />)
          .toArray()
      }
    </ArrayProvider>,
  );

  // After doubling [1,2,3,4,5] we get [2,4,6,8,10]
  // After filtering > 5 we get [6,8,10]
  expect(result).toEqual([6, 8, 10]);
});

test("map works with raw number arrays", async () => {
  const arr = gsx.array<number>([1, 2, 3]);
  const result = await arr.map((n) => <NumberDoubler value={n} />).toArray();

  expect(result).toEqual([2, 4, 6]);
});

test("filter works with raw number arrays", async () => {
  const arr = gsx.array<number>([1, 2, 3, 4, 5, 6]);
  const result = await arr
    .filter((n) => <AsyncNumberFilter value={n} />)
    .toArray();

  expect(result).toEqual([6]);
});

test("reduce works with raw number arrays", async () => {
  const arr = gsx.array<number>([1, 2, 3]);
  const result = await arr
    .map<number>((n) => <NumberDoubler value={n} />)
    .reduce<number>((acc: number, n: number) => <Value value={acc + n} />, 0);

  expect(result).toEqual(12); // (1*2 + 2*2 + 3*2)
});

test("flatMap works with raw number arrays", async () => {
  const arr = gsx.array<number>([1, 2]);
  const result = await arr
    .flatMap((n) => <TaskGenerator value={n} />)
    .toArray();

  expect(result).toEqual([1, 2, 2, 4]);
});

test("chains multiple operations with raw arrays", async () => {
  const arr = gsx.array<number>([1, 2, 3, 4, 5]);
  const result = await arr
    .map<number>((n) => <NumberDoubler value={n} />)
    .filter((n: number) => <AsyncNumberFilter value={n} />)
    .reduce<number>((acc: number, n: number) => <Value value={acc + n} />, 0);

  expect(result).toEqual(24); // (6 + 8 + 10) where all values > 5 are kept
});

test("filter can be used with index and array parameters for deduplication", async () => {
  const arr = gsx.array([1, 2, 2, 3, 3, 3, 4]);
  const result = await arr
    .filter((value, index, array) => (
      <Value value={array.indexOf(value) === index} />
    ))
    .toArray();

  expect(result).toEqual([1, 2, 3, 4]);
});

test("filter with index and array works with objects", async () => {
  const items = [
    { id: 1, value: "a" },
    { id: 2, value: "b" },
    { id: 1, value: "c" }, // duplicate id
    { id: 3, value: "d" },
  ];

  const result = await gsx
    .array(items)
    .filter((item, index, array) => (
      <Value value={array.findIndex((x) => x.id === item.id) === index} />
    ))
    .toArray();

  expect(result).toEqual([
    { id: 1, value: "a" },
    { id: 2, value: "b" },
    { id: 3, value: "d" },
  ]);
});

test("filter accepts boolean return type", async () => {
  const arr = gsx.array([1, 2, 3, 4, 5]);
  const result = await arr.filter((n) => n > 3).toArray();

  expect(result).toEqual([4, 5]);
});

test("filter accepts JSX.Element return type", async () => {
  const arr = gsx.array([1, 2, 3, 4, 5, 6, 7]);
  const result = await arr
    .filter((n) => <AsyncNumberFilter value={n} />)
    .toArray();

  expect(result).toEqual([6, 7]); // AsyncNumberFilter returns true for values > 5
});

test("filter with boolean return type works with index and array parameters", async () => {
  const arr = gsx.array([1, 2, 2, 3, 3, 3, 4]);
  const result = await arr
    .filter((value, index, array) => array.indexOf(value) === index)
    .toArray();

  expect(result).toEqual([1, 2, 3, 4]);
});

test("filter with JSX.Element return type works with index and array parameters", async () => {
  const arr = gsx.array([1, 2, 2, 3, 3, 3, 4]);
  const result = await arr
    .filter((value, index, array) => (
      <Value value={array.indexOf(value) === index} />
    ))
    .toArray();

  expect(result).toEqual([1, 2, 3, 4]);
});

test("filter can mix boolean and JSX.Element predicates in chain", async () => {
  const arr = gsx.array([1, 2, 3, 4, 5, 6, 6, 7]);
  const result = await arr
    // First remove duplicates using boolean predicate
    .filter((value, index, array) => array.indexOf(value) === index)
    // Then filter using JSX component
    .filter((n) => <AsyncNumberFilter value={n} />)
    .toArray();

  expect(result).toEqual([6, 7]); // unique numbers > 5
});
