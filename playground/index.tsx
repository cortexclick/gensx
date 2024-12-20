import * as gsx from "@/index";

interface LLMResearchBrainstormProps {
  prompt: string;
}
type LLMResearchBrainstormOutput = string[];
const LLMResearchBrainstorm = gsx.Component<
  LLMResearchBrainstormProps,
  LLMResearchBrainstormOutput
>(async ({ prompt }) => {
  console.log("🔍 Starting research for:", prompt);
  const topics = await Promise.resolve(["topic 1", "topic 2", "topic 3"]);
  return topics;
});

interface LLMResearchProps {
  topic: string;
}
type LLMResearchOutput = string;
const LLMResearch = gsx.Component<LLMResearchProps, LLMResearchOutput>(
  async ({ topic }) => {
    console.log("📚 Researching topic:", topic);
    return await Promise.resolve(`research results for ${topic}`);
  },
);

interface LLMWriterProps {
  research: string;
  prompt: string;
}
type LLMWriterOutput = string;
const LLMWriter = gsx.Component<LLMWriterProps, LLMWriterOutput>(
  async ({ research, prompt }) => {
    console.log("✍️  Writing draft based on research");
    return await Promise.resolve(
      `**draft\n${research}\n${prompt}\n**end draft`,
    );
  },
);

interface LLMEditorProps {
  draft: string;
}
type LLMEditorOutput = string;
const LLMEditor = gsx.Component<LLMEditorProps, LLMEditorOutput>(
  async ({ draft }) => {
    console.log("✨ Polishing final draft");
    return await Promise.resolve(`edited result: ${draft}`);
  },
);

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
      {topics => (
        <>
          {topics.map(topic => (
            <LLMResearch topic={topic} />
          ))}
        </>
      )}
    </LLMResearchBrainstorm>
    <WebResearcher prompt={prompt} />
  </>
));

interface BlogWritingWorkflowProps {
  prompt: string;
}
type BlogWritingWorkflowOutput = string;
const BlogWritingWorkflow = gsx.Component<
  BlogWritingWorkflowProps,
  BlogWritingWorkflowOutput
>(async ({ prompt }) => (
  <ParallelResearch prompt={prompt}>
    {([catalogResearch, webResearch]) => {
      console.log("🧠 Research:", { catalogResearch, webResearch });
      return (
        <LLMWriter research={catalogResearch.join("\n")} prompt={prompt}>
          {draft => <LLMEditor draft={draft} />}
        </LLMWriter>
      );
    }}
  </ParallelResearch>
));

async function main() {
  console.log("🚀 Starting blog writing workflow");

  // Use the gensx function to execute the workflow and annotate with the output type.
  const result = await gsx.execute<string>(
    <BlogWritingWorkflow prompt="Write a blog post about the future of AI" />,
  );
  console.log("✅ Final result:", { result });
}

await main();
