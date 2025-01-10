import { setTimeout } from "timers/promises";

import { expect, suite, test } from "vitest";

import { gsx } from "@/index";

suite("gensx", () => {
  test("returns a result", async () => {
    const Component = gsx.Component<{ foo: string }, string>(
      async ({ foo }) => {
        await setTimeout(0);
        return foo;
      },
    );
    const result = await gsx.execute(<Component foo="bar" />);
    expect(result).toBe("bar");
  });

  test("passes result to child function", async () => {
    const Component = gsx.Component<{ foo: string }, string>(
      async ({ foo }) => {
        await setTimeout(0);
        return foo;
      },
    );
    const result = await gsx.execute(
      <Component foo="bar">
        {async foo => {
          await setTimeout(0);
          return foo + " world";
        }}
      </Component>,
    );
    expect(result).toBe("bar world");
  });

  test("returns result from nested child component", async () => {
    const Component = gsx.Component<{ foo: string }, string>(
      async ({ foo }) => {
        await setTimeout(0);
        return "hello " + foo;
      },
    );
    const result = await gsx.execute(
      <Component foo="bar">
        {foo => {
          return <Component foo={foo + " world"} />;
        }}
      </Component>,
    );
    expect(result).toBe("hello hello bar world");
  });

  test("returns results from an object of child components", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const Component = gsx.Component<{ input: string }, string>(
      async ({ input }) => {
        await setTimeout(0);
        return {
          once: <Doubler input={input} />,
          twice: (
            <Doubler input={input}>
              {result => <Doubler input={result} />}
            </Doubler>
          ),
        };
      },
    );

    const result = await gsx.execute(<Component input="foo" />);
    expect(result).toEqual({
      once: "foofoo",
      twice: "foofoofoofoo",
    });
  });

  test("returns results from an array of child components", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const Component = gsx.Component<{ input: string }, string>(
      async ({ input }) => {
        await setTimeout(0);
        return [
          <Doubler input={input} />,
          <Doubler input={input}>
            {result => <Doubler input={result} />}
          </Doubler>,
        ];
      },
    );

    const result = await gsx.execute(<Component input="foo" />);
    expect(result).toEqual(["foofoo", "foofoofoofoo"]);
  });

  test("returns results from a fragment", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const Component = gsx.Component<{ input: string }, string>(
      async ({ input }) => {
        await setTimeout(0);
        return <Doubler input={input} />;
      },
    );

    const result = await gsx.execute(
      <Component input="foo">
        {result => (
          <>
            <Doubler input={result} />
            <Doubler input="bar" />
          </>
        )}
      </Component>,
    );
    expect(result).toEqual(["foofoofoofoo", "barbar"]);
  });
});
