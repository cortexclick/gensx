import { ChatCompletion, OpenAIProvider } from "@gensx/openai";
import { gsx } from "gensx";


interface LLMWriterProps {
  prompt: string;
}
type LLMWriterOutput = string;
const LLMWriter = gsx.Component<LLMWriterProps, LLMWriterOutput>(
  function LLMWriter({ prompt }) {
    const systemPrompt = `You are a helpful assistant that writes blog posts. The user will provide a prompt and you will write a blog post based on the prompt. Unless specified by the user, the blog post should be 200 words.`;

    return (
      <ChatCompletion
        model="gpt-4o-mini"
        temperature={0}
        messages={[
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ]}
      />
    );
  },
);

interface BlogWritingWorkflowProps {
  prompt: string;
}
export const BlogWritingWorkflow =
  gsx.Component<BlogWritingWorkflowProps, string>(
    function BlogWritingWorkflow({ prompt }) {
      return (
        <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
          <LLMWriter prompt={prompt} />
        </OpenAIProvider>
      );
    },
  );
