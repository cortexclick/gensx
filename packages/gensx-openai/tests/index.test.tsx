import { gsx, Streamable } from "gensx";
import OpenAI from "openai";
import { ChatCompletionCreateParams } from "openai/resources/index.mjs";
import { expect, suite, test, vi } from "vitest";

import { ChatCompletion, OpenAIContext, OpenAIProvider } from "@/index.js";

import { createMockChatCompletionChunks } from "./helpers.js";

vi.mock("openai", async (importOriginal) => {
  const originalOpenAI: Awaited<typeof import("openai")> =
    await importOriginal();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockedOpenAIClass: any = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  mockedOpenAIClass.prototype = {
    chat: {
      completions: {
        create: vi
          .fn()
          .mockImplementation((params: ChatCompletionCreateParams) => {
            if (params.stream) {
              const chunks = createMockChatCompletionChunks("Hello World");
              return Promise.resolve({
                [Symbol.asyncIterator]: async function* () {
                  for (const chunk of chunks) {
                    await Promise.resolve();
                    yield chunk;
                  }
                },
              });
            } else {
              return Promise.resolve({
                choices: [{ message: { content: "Hello World" } }],
              });
            }
          }),
      },
    },
  };

  return {
    ...originalOpenAI,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    default: mockedOpenAIClass,
  };
});

suite("OpenAIContext", () => {
  test("provides OpenAI client to children", async () => {
    let capturedClient: OpenAI | undefined;

    const TestComponent = gsx.Component<{}, null>("TestComponent", () => {
      const context = gsx.useContext(OpenAIContext);
      capturedClient = context.client;
      return null;
    });

    await gsx.execute(
      <OpenAIProvider apiKey="test">
        <TestComponent />
      </OpenAIProvider>,
    );

    expect(capturedClient).toBeDefined();
  });

  test("throws error when client is not provided", async () => {
    const TestComponent = gsx.Component<{}, string>("TestComponent", () => (
      <ChatCompletion
        model="gpt-4"
        messages={[{ role: "user", content: "test" }]}
      />
    ));

    await expect(() => gsx.execute(<TestComponent />)).rejects.toThrow(
      "OpenAI client not found in context",
    );
  });

  test("can provide a custom client", async () => {
    const customClient = new OpenAI({ apiKey: "test" });

    const TestComponent = gsx.Component<{}, null>("TestComponent", () => {
      const context = gsx.useContext(OpenAIContext);
      expect(context.client).toBe(customClient);
      return null;
    });

    await gsx.execute(
      <OpenAIContext.Provider value={{ client: customClient }}>
        <TestComponent />
      </OpenAIContext.Provider>,
    );
  });
});

suite("ChatCompletion", () => {
  test("handles streaming response", async () => {
    const TestComponent = gsx.StreamComponent<{}>("TestComponent", () => (
      <ChatCompletion
        stream={true}
        model="gpt-4"
        messages={[{ role: "user", content: "test" }]}
      >
        {(completion: string) => completion}
      </ChatCompletion>
    ));

    const result = await gsx.execute<Streamable>(
      <OpenAIProvider apiKey="test">
        <TestComponent />
      </OpenAIProvider>,
    );

    let accumulated = "";
    for await (const chunk of result) {
      if (typeof chunk === "string") {
        accumulated += chunk;
      } else {
        accumulated += JSON.stringify(chunk);
      }
    }

    expect(accumulated).toBe("Hello World ");
  });

  test("handles non-streaming response", async () => {
    const TestComponent = gsx.Component<{}, string>("TestComponent", () => (
      <ChatCompletion
        model="gpt-4"
        messages={[{ role: "user", content: "test" }]}
      >
        {(completion: string) => completion}
      </ChatCompletion>
    ));

    const result = await gsx.execute(
      <OpenAIProvider apiKey="test">
        <TestComponent />
      </OpenAIProvider>,
    );

    expect(result).toBe("Hello World");
  });
});
