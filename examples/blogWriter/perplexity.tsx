import { createOpenAIClientContext } from "@gensx/openai";

const { Provider, ChatCompletion } = createOpenAIClientContext<
  | "llama-3.1-sonar-small-128k-online"
  | "llama-3.1-sonar-large-128k-online"
  | "llama-3.1-sonar-huge-128k-online"
>(
  {
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: "https://api.perplexity.ai/chat/completions",
  },
  "Perplexity",
);

export { Provider, ChatCompletion };
