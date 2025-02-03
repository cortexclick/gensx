/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { gsx } from "gensx";
import {
  ChatCompletion as ChatCompletionOutput,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { Stream } from "openai/streaming";

import { OpenAIContext } from "./index.js";
import { GSXStructuredOutput, GSXTool } from "./newCompletion.js";

// Base types for OpenAI chat completion
type OpenAIChatCompletionProps =
  | (Omit<ChatCompletionCreateParamsNonStreaming, "tools"> & {
      tools?: ChatCompletionTool[];
    })
  | (Omit<ChatCompletionCreateParamsStreaming, "tools"> & {
      tools?: ChatCompletionTool[];
    });

type OpenAIChatCompletionOutput =
  | ChatCompletionOutput
  | Stream<ChatCompletionChunk>;

// Stream completion component
type StreamCompletionProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream: true;
  tools?: GSXTool<any>[];
};

type StreamCompletionOutput = Stream<ChatCompletionChunk>;

// Tool execution component
interface ToolExecutorProps {
  tools: GSXTool<any>[];
  toolCalls: NonNullable<
    ChatCompletionOutput["choices"][0]["message"]["tool_calls"]
  >;
  messages: ChatCompletionMessageParam[];
  model: string;
}

type ToolExecutorOutput = ChatCompletionMessageParam[];

// Tools completion component
type ToolsCompletionProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  tools: GSXTool<any>[];
};

type ToolsCompletionOutput = OpenAIChatCompletionOutput;

// Updated type to include retry options
type StructuredOutputProps<O = unknown> = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  structuredOutput: GSXStructuredOutput<O>;
  tools?: GSXTool<any>[];
  retry?: {
    maxAttempts?: number;
    backoff?: "exponential" | "linear";
    onRetry?: (attempt: number, error: Error, lastResponse?: string) => void;
    shouldRetry?: (error: Error, attempt: number) => boolean;
  };
};

type StructuredOutputOutput<T> = T;

// Types for the composition-based implementation
type StreamingProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream: true;
  tools?: GSXTool<any>[];
};

type StructuredProps<O = unknown> = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream?: false;
  tools?: GSXTool<any>[];
  structuredOutput: GSXStructuredOutput<O>;
};

type StandardProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  stream?: false;
  tools?: GSXTool<any>[];
  structuredOutput?: never;
};

type GSXCompletionProps<O = unknown> =
  | StreamingProps
  | StructuredProps<O>
  | StandardProps;

type GSXCompletionOutput<P> = P extends StreamingProps
  ? Stream<ChatCompletionChunk>
  : P extends StructuredProps<infer O>
    ? O
    : ChatCompletionOutput;

// OpenAI chat completion component that directly calls the API
export const OpenAIChatCompletion = gsx.Component<
  OpenAIChatCompletionProps,
  OpenAIChatCompletionOutput
>("OpenAIChatCompletion", async (props) => {
  const context = gsx.useContext(OpenAIContext);
  if (!context.client) {
    throw new Error(
      "OpenAI client not found in context. Please wrap your component with OpenAIProvider.",
    );
  }

  return context.client.chat.completions.create(props);
});

// Stream completion component
export const StreamCompletion = gsx.Component<
  StreamCompletionProps,
  StreamCompletionOutput
>("StreamCompletion", async (props) => {
  const { stream, tools, ...rest } = props;

  // If we have tools, first make a synchronous call to get tool calls
  if (tools?.length) {
    // Make initial completion to get tool calls
    const completion = await gsx.executeChild<ChatCompletionOutput>(
      <OpenAIChatCompletion {...rest} tools={tools} stream={false} />,
    );

    const toolCalls = completion.choices[0]?.message?.tool_calls;
    // If no tool calls, proceed with streaming the original response
    if (!toolCalls?.length) {
      return gsx.executeChild<Stream<ChatCompletionChunk>>(
        <OpenAIChatCompletion {...rest} stream={true} />,
      );
    }

    // Execute tools
    const toolResponses = await gsx.executeChild<ChatCompletionMessageParam[]>(
      <ToolExecutor
        tools={tools}
        toolCalls={toolCalls}
        messages={[...rest.messages, completion.choices[0].message]}
        model={rest.model}
      />,
    );

    // Make final streaming call with all messages
    return gsx.executeChild<Stream<ChatCompletionChunk>>(
      <OpenAIChatCompletion
        {...rest}
        messages={[
          ...rest.messages,
          completion.choices[0].message,
          ...toolResponses,
        ]}
        stream={true}
      />,
    );
  }

  // No tools, just stream normally
  return gsx.executeChild<Stream<ChatCompletionChunk>>(
    <OpenAIChatCompletion {...rest} tools={tools} stream={true} />,
  );
});

// Tool execution component
export const ToolExecutor = gsx.Component<
  ToolExecutorProps,
  ToolExecutorOutput
>("ToolExecutor", async (props) => {
  const { tools, toolCalls } = props;
  const context = gsx.useContext(OpenAIContext);
  if (!context.client) {
    throw new Error(
      "OpenAI client not found in context. Please wrap your component with OpenAIProvider.",
    );
  }

  // Execute each tool call
  return await Promise.all(
    toolCalls.map(async (toolCall) => {
      const tool = tools.find((t) => t.name === toolCall.function.name);
      if (!tool) {
        throw new Error(`Tool ${toolCall.function.name} not found`);
      }

      try {
        const args = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
        const validated = tool.parameters.safeParse(args);
        if (!validated.success) {
          throw new Error(`Invalid tool arguments: ${validated.error.message}`);
        }
        const result = await tool.execute(validated.data);
        return {
          tool_call_id: toolCall.id,
          role: "tool" as const,
          content: typeof result === "string" ? result : JSON.stringify(result),
        };
      } catch (e) {
        throw new Error(
          `Failed to execute tool ${toolCall.function.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }),
  );
});

// Tools completion component
export const ToolsCompletion = gsx.Component<
  ToolsCompletionProps,
  ToolsCompletionOutput
>("ToolsCompletion", async (props) => {
  const { tools, ...rest } = props;
  const currentMessages = [...rest.messages];

  // Make initial completion
  let completion = await gsx.executeChild<ChatCompletionOutput>(
    <OpenAIChatCompletion {...rest} messages={currentMessages} tools={tools} />,
  );

  // Keep processing tool calls until none are left
  while (completion.choices[0].message.tool_calls?.length) {
    // Add assistant's message to the conversation
    currentMessages.push(completion.choices[0].message);

    // Execute tools
    const toolResponses = await gsx.executeChild<ChatCompletionMessageParam[]>(
      <ToolExecutor
        tools={tools}
        toolCalls={completion.choices[0].message.tool_calls}
        messages={currentMessages}
        model={rest.model}
      />,
    );

    // Add tool responses to the conversation
    currentMessages.push(...toolResponses);

    // Make next completion
    completion = await gsx.executeChild<ChatCompletionOutput>(
      <OpenAIChatCompletion
        {...rest}
        messages={currentMessages}
        tools={tools}
      />,
    );
  }

  return completion;
});

// Combined structured output component
export const StructuredOutput = gsx.Component<
  StructuredOutputProps,
  StructuredOutputOutput<unknown>
>("StructuredOutput", async (props) => {
  const { structuredOutput, tools, retry, ...rest } = props;
  const maxAttempts = retry?.maxAttempts ?? 3;
  let lastError: Error | undefined;
  let lastResponse: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Add retry context to messages if not first attempt
      const messages = [...rest.messages];
      if (attempt > 1) {
        messages.push({
          role: "system",
          content: `Previous attempt failed: ${lastError?.message}. Please fix the JSON structure and try again.`,
        });
      }

      // Make initial completion
      const completion = await gsx.executeChild<ChatCompletionOutput>(
        <OpenAIChatCompletion
          {...rest}
          messages={messages}
          tools={tools}
          response_format={structuredOutput.toResponseFormat()}
        />,
      );

      const toolCalls = completion.choices[0].message.tool_calls;
      // If we have tool calls, execute them and make another completion
      if (toolCalls?.length && tools) {
        const toolResult = await gsx.executeChild<ChatCompletionOutput>(
          <ToolExecutor
            tools={tools}
            toolCalls={toolCalls}
            messages={[...messages, completion.choices[0].message]}
            model={rest.model}
          />,
        );

        // Parse and validate the final result
        const content = toolResult.choices[0]?.message.content;
        if (!content) {
          throw new Error(
            "No content returned from OpenAI after tool execution",
          );
        }

        lastResponse = content;
        const parsed = JSON.parse(content) as unknown;
        const validated = structuredOutput.safeParse(parsed);
        if (!validated.success) {
          throw new Error(
            `Invalid structured output: ${validated.error.message}`,
          );
        }
        return validated.data;
      }

      // No tool calls, parse and validate the direct result
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("No content returned from OpenAI");
      }

      lastResponse = content;
      const parsed = JSON.parse(content) as unknown;
      const validated = structuredOutput.safeParse(parsed);
      if (!validated.success) {
        throw new Error(
          `Invalid structured output: ${validated.error.message}`,
        );
      }
      return validated.data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // Call onRetry callback if provided
      retry?.onRetry?.(attempt, lastError, lastResponse);

      // Check if we should retry
      const shouldRetry = retry?.shouldRetry?.(lastError, attempt) ?? true;
      if (!shouldRetry || attempt === maxAttempts) {
        throw new Error(
          `Failed to get valid structured output after ${attempt} attempts. Last error: ${lastError.message}`,
        );
      }

      // Apply backoff if specified
      if (retry?.backoff) {
        const delay =
          retry.backoff === "exponential"
            ? Math.pow(2, attempt - 1) * 1000
            : attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
});

// Update CompositionCompletion to use the renamed component
export const GSXCompletion = gsx.Component<
  GSXCompletionProps,
  GSXCompletionOutput<GSXCompletionProps>
>("GSXCompletion", (props) => {
  // Handle streaming case
  if (props.stream) {
    const { tools, ...rest } = props;
    return <StreamCompletion {...rest} tools={tools} stream={true} />;
  }

  // Handle structured output case
  if ("structuredOutput" in props && props.structuredOutput) {
    const { tools, structuredOutput, ...rest } = props;
    return (
      <StructuredOutput
        {...rest}
        tools={tools}
        structuredOutput={structuredOutput}
      />
    );
  }

  // Handle standard case (with or without tools)
  const { tools, ...rest } = props;
  if (tools) {
    return <ToolsCompletion {...rest} tools={tools} />;
  }
  return <OpenAIChatCompletion {...rest} />;
});
