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
});
