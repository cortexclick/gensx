import { setTimeout } from "timers/promises";

import { expect, suite, test } from "vitest";

import { gsx, Streamable } from "@/index";

async function* stream(foo: string) {
  yield "Hello ";
  yield "World";
  yield "!\n\n";
  yield "H";
  yield "e";
  yield "r";
  yield "e";
  yield " ";
  yield "i";
  yield "s";
  yield " ";
  yield "t";
  yield "h";
  yield "e";
  yield " ";
  yield "p";
  yield "r";
  yield "o";
  yield "m";
  yield "p";
  yield "t";
  yield "\n";
  for (const char of foo) {
    await setTimeout(0);
    yield char;
  }
}

function* iterate(foo: string) {
  yield "Hello ";
  yield "World";
  yield "!\n\n";
  yield "H";
  yield "e";
  yield "r";
  yield "e";
  yield " ";
  yield "i";
  yield "s";
  yield " ";
  yield "t";
  yield "h";
  yield "e";
  yield " ";
  yield "p";
  yield "r";
  yield "o";
  yield "m";
  yield "p";
  yield "t";
  yield "\n";
  for (const char of foo) {
    yield char;
  }
}

async function* streamWithDelay(foo: string) {
  yield "Hello ";
  // Add artificial delay only after first token
  await setTimeout(1000);
  yield "World";
  yield "! " + foo;
}

suite("streaming", () => {
  test("returns the stream immediately without pre-resolving", async () => {
    const DelayedComponent = gsx.StreamComponent<{ foo: string }>(
      "DelayedComponent",
      ({ foo }) => {
        return streamWithDelay(foo);
      },
    );

    const start = performance.now();
    const result = await gsx.execute<Streamable>(
      <DelayedComponent stream={true} foo="bar" />,
    );

    // Get just the first token, the component delays for 1 second before yielding the first token
    const firstToken = await result.next();
    const timeToFirstToken = performance.now() - start;

    expect(firstToken.value).toBe("Hello ");
    // The delay is 1 second, so this gives us a big amount of leeway
    expect(timeToFirstToken).toBeLessThan(100);
  });

  // Test both async and sync versions of the component
  for (const isAsync of [true, false]) {
    suite(
      `for a ${isAsync ? "AsyncIterableIterator" : "IterableIterator"}`,
      () => {
        const MyComponent = gsx.StreamComponent<{ foo: string }>(
          "MyComponent",
          ({ foo }) => {
            let iterator: Streamable;

            if (isAsync) {
              iterator = stream(foo);
            } else {
              iterator = iterate(foo);
            }

            return iterator;
          },
        );

        test("returns the results directly", async () => {
          const result = await gsx.execute<string>(<MyComponent foo="bar" />);
          expect(result).toEqual("Hello World!\n\nHere is the prompt\nbar");
        });

        test("returns a streamable", async () => {
          const result = await gsx.execute<Streamable>(
            <MyComponent stream={true} foo="bar" />,
          );
          let accumulated = "";
          for await (const token of result) {
            if (typeof token === "string") {
              accumulated += token;
            } else {
              accumulated += JSON.stringify(token);
            }
          }
          expect(accumulated).toEqual(
            "Hello World!\n\nHere is the prompt\nbar",
          );
        });

        test("can be used with async child function as a stream", async () => {
          let result = "";
          await gsx.execute(
            <MyComponent stream={true} foo="bar">
              {async (response: Streamable) => {
                for await (const token of response) {
                  if (typeof token === "string") {
                    result += token;
                  } else {
                    result += JSON.stringify(token);
                  }
                }
              }}
            </MyComponent>,
          );
          expect(result).toEqual("Hello World!\n\nHere is the prompt\nbar");
        });

        test("can be used with child function without streaming", async () => {
          let result = "";
          await gsx.execute(
            <MyComponent foo="bar">
              {(response: string) => {
                result = response;
              }}
            </MyComponent>,
          );
          expect(result).toEqual("Hello World!\n\nHere is the prompt\nbar");
        });

        test("can be used with async child function without streaming", async () => {
          let result = "";
          await gsx.execute(
            <MyComponent foo="bar">
              {async (response: string) => {
                await setTimeout(0);
                result = response;
              }}
            </MyComponent>,
          );
          expect(result).toEqual("Hello World!\n\nHere is the prompt\nbar");
        });

        test("stacked streaming components return a streamable for stream=true", async () => {
          const StreamPassThrough = gsx.StreamComponent<{
            input: string;
          }>("StreamPassThrough", async ({ input }) => {
            await setTimeout(0);
            return <MyComponent stream={true} foo={input} />;
          });

          const result = await gsx.execute<Streamable>(
            <StreamPassThrough input="foo" stream={true} />,
          );
          let accumulated = "";
          for await (const token of result) {
            if (typeof token === "string") {
              accumulated += token;
            } else {
              accumulated += JSON.stringify(token);
            }
          }
          expect(accumulated).toEqual(
            "Hello World!\n\nHere is the prompt\nfoo",
          );
        });

        test("stacked streaming components return a string for stream=false", async () => {
          const StreamPassThrough = gsx.StreamComponent<{ input: string }>(
            "StreamPassThrough",
            async ({ input }) => {
              await setTimeout(0);
              return <MyComponent stream={true} foo={input} />;
            },
          );
          const result = await gsx.execute<string>(
            <StreamPassThrough input="foo" />,
          );
          expect(result).toEqual("Hello World!\n\nHere is the prompt\nfoo");
        });
      },
    );
  }
});
