import { setTimeout } from "timers/promises";

import { expect, suite, test } from "vitest";

import { gsx } from "@/index.js";

suite("jsx-runtime", () => {
  test("can create element from component", async () => {
    const MyComponent = gsx.Component<{}, string>("MyComponent", async () => {
      await setTimeout(0);
      return "test";
    });

    const result = await gsx.execute(<MyComponent />);
    expect(result).toBe("test");
  });

  test("can create element from component with children", async () => {
    const MyComponent = gsx.Component<{}, string>("MyComponent", async () => {
      await setTimeout(0);
      return "test";
    });

    const result = await gsx.execute(
      <MyComponent>
        {async (value) => {
          await setTimeout(0);
          return value + " world";
        }}
      </MyComponent>,
    );
    expect(result).toBe("test world");
  });

  test("child does not receive children prop", async () => {
    let childReceivedProps: Record<string, unknown> | undefined = undefined;

    const Child = gsx.Component<{}, string>("Child", props => {
      childReceivedProps = props;
      return "child";
    });

    const Parent = gsx.Component<{}, string>("Parent", async () => {
      return await gsx.execute(
        <Child>{(val: string) => val + " extra"}</Child>,
      );
    });

    await gsx.execute(<Parent />);

    expect(childReceivedProps).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    expect((childReceivedProps as any)?.children).toBeUndefined();
  });
});
