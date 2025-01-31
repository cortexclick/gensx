import { setTimeout } from "timers/promises";

import { expect, suite, test } from "vitest";

import { gsx } from "@/index";

suite("gensx", () => {
  test("returns a result", async () => {
    const MyComponent = gsx.Component<{ foo: string }, string>(
      "MyComponent",
      async ({ foo }) => {
        await setTimeout(0);
        return foo;
      },
    );
    const result = await gsx.execute(<MyComponent foo="bar" />);
    expect(result).toBe("bar");
  });

  test("passes result to child function", async () => {
    const MyComponent = gsx.Component<{ foo: string }, string>(
      "MyComponent",
      async ({ foo }) => {
        await setTimeout(0);
        return foo;
      },
    );

    const result = await gsx.execute(
      <MyComponent foo="bar">
        {async (foo) => {
          await setTimeout(0);
          return foo + " world";
        }}
      </MyComponent>,
    );
    expect(result).toBe("bar world");
  });

  test("returns result from nested child component", async () => {
    const MyComponent = gsx.Component<{ foo: string }, string>(
      "MyComponent",
      async ({ foo }) => {
        await setTimeout(0);
        return "hello " + foo;
      },
    );

    const result = await gsx.execute(
      <MyComponent foo="bar">
        {(foo) => {
          return <MyComponent foo={foo + " world"} />;
        }}
      </MyComponent>,
    );
    expect(result).toBe("hello hello bar world");
  });

  test("returns results from an object of child components", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      "Doubler",
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const MyComponent = gsx.Component<
      { input: string },
      { once: string; twice: string }
    >("MyComponent", async ({ input }) => {
      await setTimeout(0);
      return {
        once: <Doubler input={input} />,
        twice: (
          <Doubler input={input}>
            {(result) => <Doubler input={result} />}
          </Doubler>
        ),
      };
    });

    const result = await gsx.execute(<MyComponent input="foo" />);
    expect(result).toEqual({
      once: "foofoo",
      twice: "foofoofoofoo",
    });
  });

  test("returns results from a fragment child", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      "Doubler",
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const MyComponent = gsx.Component<{ input: string }, string[]>(
      "MyComponent",
      async ({ input }) => {
        await setTimeout(0);
        return (
          <>
            <Doubler input={input} />
            <Doubler input={input}>
              {(result) => <Doubler input={result} />}
            </Doubler>
          </>
        );
      },
    );

    const result = await gsx.execute(<MyComponent input="foo" />);
    expect(result).toEqual(["foofoo", "foofoofoofoo"]);
  });

  test("returns results from an array of child components", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      "Doubler",
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const MyComponent = gsx.Component<{ input: string }, [string, string]>(
      "MyComponent",
      async ({ input }) => {
        await setTimeout(0);
        return [
          <Doubler input={input} />,
          <Doubler input={input}>
            {(result) => <Doubler input={result} />}
          </Doubler>,
        ];
      },
    );

    const result = await gsx.execute(<MyComponent input="foo" />);
    expect(result).toEqual(["foofoo", "foofoofoofoo"]);
  });

  test("returns results from a fragment", async () => {
    const Doubler = gsx.Component<{ input: string }, string>(
      "Doubler",
      async ({ input }) => {
        await setTimeout(0);
        return `${input}${input}`;
      },
    );

    const MyComponent = gsx.Component<{ input: string }, string>(
      "MyComponent",
      async ({ input }) => {
        await setTimeout(0);
        return <Doubler input={input} />;
      },
    );

    const result = await gsx.execute(
      <MyComponent input="foo">
        {(result) => (
          <>
            <Doubler input={result} />
            <Doubler input="bar" />
          </>
        )}
      </MyComponent>,
    );
    expect(result).toEqual(["foofoofoofoo", "barbar"]);
  });
});
