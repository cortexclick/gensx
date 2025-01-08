import { ChatCompletion, OpenAIProvider } from "@gensx/openai";
import { gsx } from "gensx";

interface LLMResearchBrainstormProps {
  prompt: string;
}
interface LLMResearchBrainstormOutput {
  topics: string[];
}
const LLMResearchBrainstorm = gsx.Component<
  LLMResearchBrainstormProps,
  LLMResearchBrainstormOutput
>(async ({ prompt }) => {
  console.log("🔍 Starting research for:", prompt);
  const systemPrompt = `You are a helpful assistant that brainstorms topics for a researching a blog post. The user will provide a prompt and you will brainstorm topics based on the prompt. You should return 3 - 5 topics, as a JSON array.

Here is an example of the JSON output: { "topics": ["topic 1", "topic 2", "topic 3"] }`;
  return (
    <ChatCompletion
      model="gpt-4o-mini"
      temperature={0.5}
      messages={[
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ]}
      response_format={{ type: "json_object" }}
    >
      {
        // TODO: Figure out why this needs a type annotation, but other components do not.
        (completion: string) => JSON.parse(completion ?? '{ "topics": [] }')
      }
    </ChatCompletion>
  );
});

interface LLMResearchProps {
  topic: string;
}
type LLMResearchOutput = string;
const LLMResearch = gsx.Component<LLMResearchProps, LLMResearchOutput>(
  async ({ topic }) => {
    console.log("📚 Researching topic:", topic);
    const systemPrompt = `You are a helpful assistant that researches topics. The user will provide a topic and you will research the topic. You should return a summary of the research, summarizing the most important points in a few sentences at most.`;

    return (
      <ChatCompletion
        model="gpt-4o-mini"
        temperature={0}
        messages={[
          { role: "system", content: systemPrompt },
          { role: "user", content: topic },
        ]}
      />
    );
  },
);

interface LLMWriterProps {
  research: string[];
  prompt: string;
}
type LLMWriterOutput = string;
const LLMWriter = gsx.Component<LLMWriterProps, LLMWriterOutput>(
  async ({ prompt, research }) => {
    const systemPrompt = `You are a helpful assistant that writes blog posts. The user will provide a prompt and you will write a blog post based on the prompt. Unless specified by the user, the blog post should be 200 words.

Here is the research for the blog post: ${research.join("\n")}`;

    console.log("🚀 Writing blog post for:", { prompt, research });
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

interface LLMEditorProps {
  draft: string;
}
const LLMEditor = gsx.StreamComponent<LLMEditorProps>(async ({ draft }) => {
  console.log("🔍 Editing draft");
  const systemPrompt = `You are a helpful assistant that edits blog posts. The user will provide a draft and you will edit it to make it more engaging and interesting.`;

  return (
    <ChatCompletion
      providerName="claude"
      stream={true}
      model="claude-3-5-sonnet-20240620"
      temperature={0}
      messages={[
        { role: "system", content: systemPrompt },
        { role: "user", content: draft },
      ]}
    />
  );
});

interface WebResearcherProps {
  prompt: string;
}
type WebResearcherOutput = string[];
const WebResearcher = gsx.Component<WebResearcherProps, WebResearcherOutput>(
  async ({ prompt }) => {
    console.log("🌐 Researching web for:", prompt);
    const results = await Promise.resolve([
      "web result 1",
      "web result 2",
      "web result 3",
    ]);
    return results;
  },
);

type ParallelResearchOutput = [string[], string[]];
interface ParallelResearchComponentProps {
  prompt: string;
}
const ParallelResearch = gsx.Component<
  ParallelResearchComponentProps,
  ParallelResearchOutput
>(({ prompt }) => (
  <>
    <LLMResearchBrainstorm prompt={prompt}>
      {({ topics }) => {
        return topics.map((topic) => <LLMResearch topic={topic} />);
      }}
    </LLMResearchBrainstorm>
    <WebResearcher prompt={prompt} />
  </>
));

interface BlogWritingWorkflowProps {
  prompt: string;
}
export const BlogWritingWorkflow =
  gsx.StreamComponent<BlogWritingWorkflowProps>(async ({ prompt }) => {
    return (
      <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
        <OpenAIProvider
          apiKey={process.env.CLAUDE_API_KEY}
          providerName="claude"
          apiEndpoint="https://api.anthropic.com/v1"
        >
          <ParallelResearch prompt={prompt}>
            {(research) => (
              <LLMWriter prompt={prompt} research={research.flat()}>
                {(draft) => <LLMEditor draft={draft} stream={true} />}
              </LLMWriter>
            )}
          </ParallelResearch>
        </OpenAIProvider>
      </OpenAIProvider>
    );
  });
