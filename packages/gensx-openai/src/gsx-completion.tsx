/* eslint-disable @typescript-eslint/no-explicit-any */

import { gsx } from "gensx";
import {
  ChatCompletion as ChatCompletionOutput,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { Stream } from "openai/streaming";
import { z } from "zod";

import { OpenAIChatCompletion } from "./openai.js";
import { StreamCompletion } from "./stream.js";
import { StructuredOutput } from "./structured-output.js";
import { GSXTool, ToolsCompletion } from "./tools.js";
// Types for the composition-based implementation
export type StreamingProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream: true;
  tools?: GSXTool<any>[];
};

export type StructuredProps<O = unknown> = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream?: false;
  tools?: GSXTool<any>[];
  outputSchema: z.ZodSchema<O>;
};

export type StandardProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream?: false;
  tools?: GSXTool<any>[];
  outputSchema?: never;
};

export type GSXChatCompletionProps<O = unknown> =
  | StreamingProps
  | StructuredProps<O>
  | StandardProps;

export type GSXChatCompletionOutput<P> = P extends StreamingProps
  ? Stream<ChatCompletionChunk>
  : P extends StructuredProps<infer O>
    ? O
    : ChatCompletionOutput;

// Update CompositionCompletion to use the renamed parameter
export const GSXChatCompletion = gsx.Component<
  GSXChatCompletionProps,
  GSXChatCompletionOutput<GSXChatCompletionProps>
>("GSXCompletion", (props) => {
  // Handle streaming case
  if (props.stream) {
    const { tools, ...rest } = props;
    return <StreamCompletion {...rest} tools={tools} stream={true} />;
  }

  // Handle structured output case
  if ("outputSchema" in props && props.outputSchema) {
    const { tools, outputSchema, ...rest } = props;
    return (
      <StructuredOutput {...rest} tools={tools} outputSchema={outputSchema} />
    );
  }

  // Handle standard case (with or without tools)
  const { tools, ...rest } = props;
  if (tools) {
    return <ToolsCompletion {...rest} tools={tools} />;
  }
  return <OpenAIChatCompletion {...rest} />;
});

// Base props type from OpenAI
export type ChatCompletionProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream?: boolean;
  tools?: GSXTool<any>[];
};

export const ChatCompletion = gsx.StreamComponent<ChatCompletionProps>(
  "ChatCompletion",
  async (props) => {
    if (props.stream) {
      const stream = await gsx.execute<Stream<ChatCompletionChunk>>(
        <GSXChatCompletion {...props} stream={true} />,
      );

      // Transform Stream<ChatCompletionChunk> into AsyncIterableIterator<string>
      const generateTokens = async function* () {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      };

      return generateTokens();
    } else {
      const response = await gsx.execute<ChatCompletionOutput>(
        <GSXChatCompletion {...props} stream={false} />,
      );
      const content = response.choices[0]?.message?.content ?? "";

      // Use sync iterator for non-streaming case, matching ChatCompletion's behavior
      function* generateTokens() {
        yield content;
      }

      return generateTokens();
    }
  },
);
