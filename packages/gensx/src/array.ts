import type { JSX } from "./jsx-runtime";

import { execute } from "./resolve";

export class GsxArray<T> {
  private promise: Promise<unknown[]>;

  constructor(items: JSX.Element[] | T[] | Promise<unknown[]>) {
    this.promise = Promise.resolve(items);
  }

  map<U>(fn: (item: T) => JSX.Element): GsxArray<U> {
    const mapped = this.promise
      .then((items) => execute<T[]>(items))
      .then((resolvedItems) => resolvedItems.map(fn));
    return new GsxArray(mapped);
  }

  flatMap<U>(fn: (item: T) => JSX.Element): GsxArray<U> {
    const mapped = this.promise
      .then((items) => execute<T[]>(items))
      .then(async (resolvedItems) => {
        const nestedResults = await Promise.all(
          resolvedItems.map(async (item) => {
            const result = await execute<U | U[]>(fn(item));
            return Array.isArray(result) ? result : [result];
          }),
        );
        return nestedResults.flat();
      });
    return new GsxArray(mapped);
  }

  filter(
    predicate: (item: T, index: number, array: T[]) => JSX.Element | boolean,
  ): GsxArray<T> {
    const filtered = this.promise
      .then((items) => execute<T[]>(items))
      .then(async (resolvedItems) => {
        const results = await Promise.all(
          resolvedItems.map(async (item, index) => {
            const predicateResult = predicate(item, index, resolvedItems);
            let keep: boolean;

            if (typeof predicateResult === "boolean") {
              keep = predicateResult;
            } else {
              // Execute the JSX element and await its result
              const result = await execute<boolean>(predicateResult);
              keep = result;
            }

            return { item, keep };
          }),
        );
        return results.filter(({ keep }) => keep).map(({ item }) => item);
      });
    return new GsxArray(filtered);
  }

  reduce<U>(fn: (acc: U, item: T) => JSX.Element, initial: U): Promise<U> {
    return this.promise
      .then((items) => execute<T[]>(items))
      .then(async (resolvedItems) => {
        let result = initial;
        for (const item of resolvedItems) {
          result = await execute<U>(fn(result, item));
        }
        return result;
      });
  }

  toArray(): Promise<T[]> {
    return this.promise.then((items) => execute<T[]>(items));
  }
}

export function array<T>(items: JSX.Element[] | T[]): GsxArray<T> {
  return new GsxArray(items);
}
