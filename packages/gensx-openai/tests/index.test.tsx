import { gsx, Streamable } from "gensx";
import OpenAI from "openai";
import { expect, suite, test } from "vitest";

import { ChatCompletion, OpenAIContext } from "@/index.js";

import { createMockOpenAIClient } from "./helpers.js";

suite("OpenAIContext", () => {
  test("provides OpenAI client to children", async () => {
    const mockClient = createMockOpenAIClient({ content: "" });
    let capturedClient: OpenAI | undefined;

    const TestComponent = gsx.Component(() => {
      const context = gsx.useContext(OpenAIContext);
      capturedClient = context.client;
      return null;
    });

    await gsx.execute(
      <OpenAIContext.Provider value={{ client: mockClient }}>
        <TestComponent />
      </OpenAIContext.Provider>,
    );

    expect(capturedClient).toBe(mockClient);
  });

  test("throws error when client is not provided", async () => {
    const TestComponent = gsx.Component(() => (
      <ChatCompletion
        model="gpt-4"
        messages={[{ role: "user", content: "test" }]}
      />
    ));

    await expect(() => gsx.execute(<TestComponent />)).rejects.toThrow(
      "OpenAI client not found in context",
    );
  });
});

suite("ChatCompletion", () => {
  test("handles streaming response", async () => {
    const mockClient = createMockOpenAIClient({ content: "Hello World" });

    const TestComponent = gsx.Component<Record<string, never>, Streamable>(
      () => (
        <ChatCompletion
          stream={true}
          model="gpt-4"
          messages={[{ role: "user", content: "test" }]}
        >
          {(completion: string) => completion}
        </ChatCompletion>
      ),
    );

    const result = await gsx.execute<Streamable>(
      <OpenAIContext.Provider value={{ client: mockClient }}>
        <TestComponent />
      </OpenAIContext.Provider>,
    );

    let resultString = "";
    for await (const chunk of result) {
      resultString += chunk;
    }

    expect(resultString).toBe("Hello World ");
  });

  test("handles non-streaming response", async () => {
    const mockClient = createMockOpenAIClient({ content: "Test response" });

    const TestComponent = gsx.Component(() => (
      <ChatCompletion
        model="gpt-4"
        messages={[{ role: "user", content: "test" }]}
      >
        {(completion: string) => completion}
      </ChatCompletion>
    ));

    const result = await gsx.execute(
      <OpenAIContext.Provider value={{ client: mockClient }}>
        <TestComponent />
      </OpenAIContext.Provider>,
    );

    expect(result).toBe("Test response");
  });
});
