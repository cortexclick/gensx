import type { Streamable } from "gensx";

import { gsx, StreamComponent } from "gensx";
import OpenAI, { ClientOptions } from "openai";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/index.mjs";
import { Stream } from "openai/streaming";

// Create a context for OpenAI
export const OpenAIContext = gsx.createContext<{
  client?: OpenAI;
}>({});

export const OpenAIProvider = gsx.Component<ClientOptions, never>((props) => {
  const client = new OpenAI(props);
  return <OpenAIContext.Provider value={{ client }} />;
});

// Create a component for chat completions
export const ChatCompletion = StreamComponent<ChatCompletionCreateParams>(
  async (props) => {
    const context = gsx.useContext(OpenAIContext);

    if (!context.client) {
      throw new Error(
        "OpenAI client not found in context. Please wrap your component with OpenAIProvider.",
      );
    }

    if (props.stream) {
      const stream = await context.client.chat.completions.create(props);

      async function* generateTokens(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        for await (const chunk of stream as Stream<ChatCompletionChunk>) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      }

      const streamable: Streamable = generateTokens();
      return streamable;
    } else {
      const response = await context.client.chat.completions.create(props);
      const content = response.choices[0]?.message?.content ?? "";

      function* generateTokens() {
        yield content;
      }

      return generateTokens();
    }
  },
);
