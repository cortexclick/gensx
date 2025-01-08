import type { Streamable } from "gensx";

import { ContextProvider, getCurrentContext, StreamComponent } from "gensx";
import OpenAI, { ClientOptions } from "openai";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/chat";
import { Stream } from "openai/streaming";

declare module "gensx" {
  interface WorkflowContext {
    openai?: OpenAI;
  }
}

export const OpenAIProvider = ContextProvider(
  (props: ClientOptions & { providerName?: string }) => {
    const openai = new OpenAI(props);

    return { [props.providerName ?? "openai"]: openai };
  },
);

export const ChatCompletion = StreamComponent<
  ChatCompletionCreateParams & { providerName?: string }
>(async (props) => {
  const context = getCurrentContext();
  const openai = context.get(props.providerName ?? "openai") as
    | OpenAI
    | undefined;

  if (!openai) {
    throw new Error(
      "OpenAI client not found in context. Please wrap your component with OpenAIProvider.",
    );
  }

  const stream = await openai.chat.completions.create(props);

  if (stream instanceof Stream) {
    // eslint-disable-next-line no-inner-declarations
    async function* generateTokens(): AsyncGenerator<string, void, undefined> {
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
    // Since our stream component API must always return a streamable, wrap the result
    const content = stream.choices[0]?.message?.content ?? "";
    // eslint-disable-next-line no-inner-declarations, @typescript-eslint/require-await
    async function* generateTokens() {
      yield content;
    }

    return generateTokens();
  }
});
