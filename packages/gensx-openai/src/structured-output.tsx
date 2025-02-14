/* eslint-disable @typescript-eslint/no-explicit-any */

import { gsx } from "gensx";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import {
  ChatCompletion as ChatCompletionOutput,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { z } from "zod";

import { OpenAIChatCompletion } from "./openai.js";
import { GSXTool, ToolExecutor } from "./tools.js";

// Updated type to include retry options
type StructuredOutputProps<O = unknown> = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "stream" | "tools"
> & {
  outputSchema: z.ZodSchema<O>;
  tools?: GSXTool<any>[];
  retry?: {
    maxAttempts?: number;
    backoff?: "exponential" | "linear";
    onRetry?: (attempt: number, error: Error, lastResponse?: string) => void;
    shouldRetry?: (error: Error, attempt: number) => boolean;
  };
};

type StructuredOutputOutput<T> = T;

// Combined structured output component
export const StructuredOutput = gsx.Component<
  StructuredOutputProps,
  StructuredOutputOutput<unknown>
>("StructuredOutput", async (props) => {
  const { outputSchema, tools, retry, ...rest } = props;
  const maxAttempts = retry?.maxAttempts ?? 3;
  let lastError: Error | undefined;
  let lastResponse: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Add retry context to messages if not first attempt
      const messages = [...rest.messages];
      if (attempt > 1) {
        messages.push({
          role: "user",
          content: `Previous attempt failed: ${lastError?.message}. Please fix the JSON structure and try again.`,
        });
      }

      // Make initial completion
      const completion = await gsx.execute<ChatCompletionOutput>(
        <OpenAIChatCompletion
          {...rest}
          messages={messages}
          tools={tools}
          response_format={zodResponseFormat(outputSchema, "output_schema")}
        />,
      );

      const toolCalls = completion.choices[0].message.tool_calls;
      // If we have tool calls, execute them and make another completion
      if (toolCalls?.length && tools) {
        const toolResult = await gsx.execute<ChatCompletionOutput>(
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
        const validated = outputSchema.safeParse(parsed);
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
      const validated = outputSchema.safeParse(parsed);
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
