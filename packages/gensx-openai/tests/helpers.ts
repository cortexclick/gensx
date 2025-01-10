import type {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/index.mjs";

import OpenAI from "openai";
import { vi } from "vitest";

export interface MockChatCompletionOptions {
  content: string;
}

export function createMockOpenAIClient(
  options: MockChatCompletionOptions = { content: "" },
): OpenAI {
  const mockClient = new OpenAI({ apiKey: "test" });

  mockClient.chat.completions.create = vi
    .fn()
    .mockImplementation((params: ChatCompletionCreateParams) => {
      if (params.stream) {
        const chunks = createMockChatCompletionChunks(options.content);
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
          choices: [{ message: { content: options.content } }],
        });
      }
    });

  return mockClient;
}

export function createMockChatCompletionChunks(
  content: string,
): ChatCompletionChunk[] {
  return content.split(" ").map((word) => ({
    id: `mock-${Math.random().toString(36).slice(2)}`,
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        delta: { content: word + " " },
        finish_reason: null,
        index: 0,
      },
    ],
  }));
}
