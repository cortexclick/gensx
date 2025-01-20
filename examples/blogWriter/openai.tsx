import { createOpenAIClientContext } from "@gensx/openai";

const { Provider, ChatCompletion } = createOpenAIClientContext(
  {
    apiKey: process.env.OPENAI_API_KEY,
  },
  "OpenAI",
);

export { Provider, ChatCompletion };
