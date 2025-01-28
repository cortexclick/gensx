import { gsx, type Streamable, type ChatResponse } from "gensx";
import { ChatCompletion, OpenAIProvider } from "@gensx/openai";
import { z } from "zod";

const EchoSchema = z.object({
  message: z.string().describe("The message to echo back"),
});

type EchoParams = z.infer<typeof EchoSchema>;

const EchoTool = gsx.Tool<typeof EchoSchema, string>({
  name: "echo",
  description: "Echoes back the message you send",
  schema: EchoSchema,
  function: async (params: EchoParams) => {
    console.log("Echo tool called with:", params);
    return `Echo: ${params.message}`;
  },
});

const GetWeatherSchema = z.object({
  location: z.string().describe("The city and state or country"),
});

type GetWeatherProps = z.infer<typeof GetWeatherSchema>;

interface GetWeatherResponse {
  temperature: number;
  conditions: string;
}

// The params will be inferred from GetWeatherSchema
const getWeatherTool = gsx.Tool<typeof GetWeatherSchema, GetWeatherResponse>({
  name: "getWeather",
  description: "Get the current weather for a location",
  schema: GetWeatherSchema,
  function: async (params: GetWeatherProps) => {
    // params.location is now properly typed as string
    console.log("Getting weather for:", params);
    return {
      temperature: 72,
      conditions: "sunny",
    };
  },
});

interface ToolExampleProps {
  message: string;
  stream: boolean;
}

const BasicToolResponseExample = gsx.Component<
  ToolExampleProps,
  GetWeatherResponse | string
>("BasicToolResponseExample", (props) => {
  return (
    <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
      <ChatCompletion
        model="gpt-4o-mini"
        gsxTools={[getWeatherTool]}
        messages={[
          {
            role: "system",
            content:
              "You are a helpful weather assistant. Use the getWeather tool when asked about weather.",
          },
          { role: "user", content: props.message },
        ]}
        stream={props.stream}
        gsxExecuteTools={false}
      />
    </OpenAIProvider>
  );
});

async function main() {
  console.log("\n🔊 Testing echo tool...");

  // Test direct function call
  const result1 = await EchoTool({ message: "Hello direct!" });
  console.log("Direct call result:", result1);

  // Test JSX usage
  const result2 = await gsx.execute(<EchoTool message="Hello JSX!" />);
  console.log("JSX call result:", result2);

  // log non-streamable result
  const result3 = await gsx.execute<ChatResponse>(
    <BasicToolResponseExample
      message="What is the weather in San Francisco?"
      stream={false}
    />,
  );
  console.log("Non-streaming tool result:", JSON.stringify(result3, null, 2));
  console.log("Non-streaming tool result type:", typeof result3);
  console.log("Has content:", "content" in result3);
  console.log("Has tool_calls:", "tool_calls" in result3);

  // Test a tool with a chat completion with a tool response
  const stream1 = await gsx.execute<Streamable>(
    <BasicToolResponseExample
      message="What is the weather in San Francisco?"
      stream={true}
    />,
  );

  console.log("\nStreaming tool response:");
  let currentToolCall: any = null;
  let accumulatedArguments = "";

  for await (const chunk of stream1) {
    if (typeof chunk === "string") {
      process.stdout.write(chunk);
    } else {
      // If this is a new tool call
      if (!currentToolCall && chunk.tool_call.id) {
        currentToolCall = chunk.tool_call;
        accumulatedArguments = chunk.tool_call.function?.arguments || "";
      }
      // If we're accumulating arguments
      else if (currentToolCall && chunk.tool_call.function?.arguments) {
        accumulatedArguments += chunk.tool_call.function.arguments;
        currentToolCall.function.arguments = accumulatedArguments;
      }

      // If we see a closing brace, print the complete tool call
      if (accumulatedArguments.trim().endsWith("}")) {
        process.stdout.write(
          "\n" + JSON.stringify({ tool_call: currentToolCall }, null, 2) + "\n",
        );
        currentToolCall = null;
        accumulatedArguments = "";
      }
    }
  }

  // log another non-streamable result
  const result4 = await gsx.execute<ChatResponse>(
    <BasicToolResponseExample
      message="What is the weather in San Francisco?"
      stream={false}
    />,
  );
  console.log("\nNon-streaming result:", JSON.stringify(result4, null, 2));
  console.log("Non-streaming result content:", result4.content);
  console.log("Non-streaming result tool_calls:", result4.tool_calls);

  // Test a tool with a chat completion with a regular response
  const stream2 = await gsx.execute<Streamable>(
    <BasicToolResponseExample message="Hello" stream={true} />,
  );

  console.log("\nStreaming response:");
  for await (const chunk of stream2) {
    if (typeof chunk === "string") {
      process.stdout.write(chunk);
    } else {
      process.stdout.write("\n" + JSON.stringify(chunk, null, 2) + "\n");
    }
  }

  // Log the OpenAPI schema
  //console.log("\nTool schema:", EchoTool.getOpenApiSchema());
}

main().catch(console.error);
