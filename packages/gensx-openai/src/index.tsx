import { gsx } from "gensx";
import OpenAI, { ClientOptions } from "openai";
import { zodFunction, zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletion as ChatCompletionOutput } from "openai/resources/chat/completions.js";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionTool,
} from "openai/resources/index.mjs";
import { Stream } from "openai/streaming";
import { z } from "zod";

// Create a context for OpenAI
export const OpenAIContext = gsx.createContext<{
  client?: OpenAI;
}>({});

// Wrapper for structured output schemas
export class GSXStructuredOutput<T> {
  constructor(
    public readonly schema: z.ZodSchema<T>,
    public readonly options: {
      description?: string;
      examples?: T[];
    } = {},
  ) {}

  static create<T>(
    schema: z.ZodSchema<T>,
    options: {
      description?: string;
      examples?: T[];
    } = {},
  ): GSXStructuredOutput<T> {
    return new GSXStructuredOutput(schema, options);
  }

  toResponseFormat() {
    return zodResponseFormat(this.schema, "object", {
      description: this.options.description,
    });
  }

  parse(data: unknown): T {
    return this.schema.parse(data);
  }

  safeParse(data: unknown): z.SafeParseReturnType<unknown, T> {
    return this.schema.safeParse(data);
  }
}

// Wrapper for tool parameter schemas
export class GSXTool<TSchema extends z.ZodObject<z.ZodRawShape>> {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly parameters: TSchema,
    public readonly execute: (args: z.infer<TSchema>) => Promise<unknown>,
    public readonly options: {
      examples?: z.infer<TSchema>[];
    } = {},
  ) {}

  static create<TSchema extends z.ZodObject<z.ZodRawShape>>(
    name: string,
    description: string,
    parameters: TSchema,
    execute: (args: z.infer<TSchema>) => Promise<unknown>,
    options: {
      examples?: z.infer<TSchema>[];
    } = {},
  ): GSXTool<TSchema> {
    return new GSXTool(name, description, parameters, execute, options);
  }

  toOpenAITool(): ChatCompletionTool {
    // Use zodFunction to get the schema, but don't use its execution capabilities
    const fn = zodFunction({
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    });

    // The function object has a type property that contains the OpenAI function definition
    const tool = fn as {
      type: "function";
      function: ChatCompletionTool["function"];
    };

    return {
      type: "function",
      function: tool.function,
    };
  }
}

// Update the props types to use our new wrappers and extend from full OpenAI types
type StreamingProps = Omit<
  ChatCompletionCreateParamsStreaming,
  "stream" | "tools" | "response_format"
> & {
  stream: true;
  tools?: GSXTool<z.ZodObject<z.ZodRawShape>>[];
  structuredOutput?: never;
};

type StructuredProps<T> = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools" | "response_format"
> & {
  stream?: false;
  tools?: GSXTool<z.ZodObject<z.ZodRawShape>>[];
  structuredOutput: GSXStructuredOutput<T>;
};

type StandardProps = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools" | "response_format"
> & {
  stream?: false;
  tools?: GSXTool<z.ZodObject<z.ZodRawShape>>[];
  structuredOutput?: never;
};

type ChatCompletionProps<T = unknown> =
  | StreamingProps
  | StructuredProps<T>
  | StandardProps;

type ChatCompletionReturn<P> = P extends StreamingProps
  ? Stream<ChatCompletionChunk>
  : P extends StructuredProps<infer T>
    ? T
    : ChatCompletionOutput;

// Enhanced version with all GSX features
export const ChatCompletion = gsx.Component<
  ChatCompletionProps,
  ChatCompletionReturn<ChatCompletionProps>
>("ChatCompletion", async (props) => {
  const context = gsx.useContext(OpenAIContext);

  if (!context.client) {
    throw new Error(
      "OpenAI client not found in context. Please wrap your component with OpenAIProvider.",
    );
  }

  // Handle streaming case
  if (props.stream) {
    const { tools, ...rest } = props;
    const openAITools = tools?.map((tool) => tool.toOpenAITool());

    const response = await context.client.chat.completions.create({
      ...rest,
      stream: true,
      tools: openAITools,
    } as ChatCompletionCreateParamsStreaming);

    return response as Stream<ChatCompletionChunk>;
  }

  // Handle structured output case
  if (props.structuredOutput) {
    const { tools, structuredOutput, ...rest } = props;
    const openAITools = tools?.map((tool) => tool.toOpenAITool());

    const completion = await context.client.chat.completions.create({
      ...rest,
      response_format: structuredOutput.toResponseFormat(),
      tools: openAITools,
    } as ChatCompletionCreateParamsNonStreaming);

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    try {
      const parsed = JSON.parse(content) as unknown;
      const validated = structuredOutput.safeParse(parsed);
      if (!validated.success) {
        throw new Error(
          `Invalid structured output: ${validated.error.message}`,
        );
      }
      return validated.data;
    } catch (e) {
      throw new Error(
        `Failed to parse structured output: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Handle standard case (with or without tools)
  const { tools, ...rest } = props;
  const openAITools = tools?.map((tool) => tool.toOpenAITool());

  return context.client.chat.completions.create({
    ...rest,
    stream: false,
    tools: openAITools,
  } as ChatCompletionCreateParamsNonStreaming) as Promise<ChatCompletionOutput>;
});

// Direct OpenAI wrapper types
type OpenAIChatCompletionProps =
  | (Omit<ChatCompletionCreateParamsStreaming, "stream"> & { stream: true })
  | (Omit<ChatCompletionCreateParamsNonStreaming, "stream"> & {
      stream?: false;
    });

type OpenAIChatCompletionReturn<P> = P extends { stream: true }
  ? Stream<ChatCompletionChunk>
  : ChatCompletionOutput;

// Direct wrapper over OpenAI's chat completion
export const OpenAIChatCompletion = gsx.Component<
  OpenAIChatCompletionProps,
  OpenAIChatCompletionReturn<OpenAIChatCompletionProps>
>("OpenAIChatCompletion", async (props) => {
  const context = gsx.useContext(OpenAIContext);

  if (!context.client) {
    throw new Error(
      "OpenAI client not found in context. Please wrap your component with OpenAIProvider.",
    );
  }

  const response = await context.client.chat.completions.create(props);
  return response as OpenAIChatCompletionReturn<typeof props>;
});

export const OpenAIProvider = gsx.Component<ClientOptions, never>(
  "OpenAIProvider",
  (args) => {
    const client = new OpenAI(args);
    return <OpenAIContext.Provider value={{ client }} />;
  },
  {
    secretProps: ["apiKey"],
  },
);
