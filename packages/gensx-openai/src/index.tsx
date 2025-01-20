import type { Streamable } from "gensx";

import { gsx } from "gensx";
import OpenAI, { ClientOptions } from "openai";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/index.mjs";
import { Stream } from "openai/streaming";

/**
 * Create a context for an OpenAI client and bind it to a ChatCompletion component. This allows you to have
 * multiple OpenAI clients that target different OpenAI-compatible API endpoints.
 *
 * @param args - The client options
 * @returns The OpenAI context and the ChatCompletion component
 */
export const createOpenAIClientContext = <
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  ModelName extends string = ChatCompletionCreateParams["model"],
>(
  args: ClientOptions,
  namePrefix: string,
) => {
  const client = new OpenAI(args);

  const OpenAIClientContext = gsx.createContext(client);

  const BoundChatCompletion = gsx.StreamComponent<
    ChatCompletionCreateParams & {
      model: ModelName;
    }
  >(`${namePrefix}ChatCompletion`, (props) => {
    const { stream, ...rest } = props;
    return (
      <ChatCompletion
        context={OpenAIClientContext}
        stream={stream ?? false}
        {...rest}
      />
    );
  });

  function OpenAIClientProvider(_: gsx.Args<{}, never>) {
    return <OpenAIClientContext.Provider value={client} />;
  }

  return {
    Provider: OpenAIClientProvider,
    ChatCompletion: BoundChatCompletion,
  };
};

export const ChatCompletion = gsx.StreamComponent<
  ChatCompletionCreateParams & { context: gsx.Context<OpenAI> }
>("ChatCompletion", async (props) => {
  const { context, ...createParams } = props;
  const client = gsx.useContext(context);

  if (props.stream) {
    const stream = await client.chat.completions.create(createParams);

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
    const response = await client.chat.completions.create(props);
    const content = response.choices[0]?.message?.content ?? "";

    function* generateTokens() {
      yield content;
    }

    return generateTokens();
  }
});
