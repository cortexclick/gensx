<h1 align="center">&lt;GenSX /&gt;</h1>

<p align="center">
  Make LLMs work good
</p>

## LLM + JSX = ⚡️

GenSX is a library for building LLM workflows, using JSX for simple and fast development.

```jsx
import * as gsx from "gensx";

const title = "How to be a 10x LLM Developer";
const prompt = "Write an article about using gensx to build LLM applications";

const [tweet, blogPost] = await gsx.execute(
  <BlogWritingWorkflow title={title} prompt={prompt}>
    {blogPost => (
      <TweetWritingWorkflow content={blogPost}>
        {tweet => {
          return [tweet, blogPost];
        }}
      </TweetWritingWorkflow>
    )}
  </BlogWritingWorkflow>,
);
```

## Getting started

### 📦 Installing

```bash
pnpm install gensx
```

```bash
yarn add gensx
```

```bash
npm install gensx
```

### Configure Typescript

```ts
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "gensx"
  }
}
```

#### For a React project with Typescript

If you're using React, and can't change the `jsxImportSource` in your `tsconfig.json` without breaking your project, you can use a [per-file pragma](https://www.typescriptlang.org/tsconfig/#jsxImportSource) to enable the `gensx` runtime for specific files.

```tsx
/** @jsxImportSource gensx */

// ...
```

Unfortunately, you cannot use both `gensx` and `react` in the same file, as they require different `jsxImportSource` values.

#### For a Babel project

If you're using babel to bundle JSX into Javascript, you can use the `@babel/plugin-transform-react-jsx` plugin to enable JSX support, and use the pragma to specify the `gensx` runtime.

```bash
pnpm install @babel/plugin-transform-react-jsx
```

```js
// babel.config.js
module.exports = {
  plugins: ["@babel/plugin-transform-react-jsx"],
};
```

```jsx
/** @jsxImportSource gensx */

// ...
```

## Building a workflow, the declarative way!

```jsx
import * as gsx from "gensx";

interface ResearchBrainstormProps {
  prompt: string;
}
type ResearchBrainstormOutput = string[];

/**
 * A `gsx.Component` is just function. Within them you can do things like make calls to your vector DB, call APIs, or invoke models like OpenAI, Claude, Perplexity, and more.
 *
 * Every `gsx.Component` automatically supports accessing it's outputs by nesting a `child` function with no additional work required. For instance:
 */
const ResearchBrainstorm = gsx.Component<
  ResearchBrainstormProps,
  ResearchBrainstormOutput
>(async ({ prompt }) => {
  console.log("🔍 Starting research for:", prompt);
  const topics = await Promise.resolve(["topic 1", "topic 2", "topic 3"]);
  return topics;
});

interface PerformResearchProps {
  topic: string;
}
type PerformResearchOutput = string;
const PerformResearch = gsx.Component<ResearchProps, ResearchOutput>(
  async ({ topic }) => {
    console.log("📚 Researching topic:", topic);
    return await Promise.resolve(`research results for ${topic}`);
  },
);

interface WriteDraftProps {
  research: string;
  prompt: string;
}
type WriteDraftOutput = string;
const WriteDraft = gsx.Component<WriteDraftProps, WriteDraftOutput>(
  async ({ research, prompt }) => {
    console.log("✍️  Writing draft based on research");
    return await Promise.resolve(
      `**draft\n${research}\n${prompt}\n**end draft`,
    );
  },
);

interface EditDraftProps {
  draft: string;
}
type EditDraftOutput = string;
const EditDraft = gsx.Component<EditDraftProps, EditDraftOutput>(
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

// You can build complex workflows by nesting components. When you pass a child function to a component, it will be called with the output of that component, and you can use that output inside any child components. If you don't specify a function as a child, the result from that leaf node will be bubbled up as the final result.
//
// We again wrap using the gsx.Component function, and we annotate the output type with the type of the final result.
const ParallelResearch = gsx.Component<
  ParallelResearchComponentProps,
  ParallelResearchOutput
>(({ prompt }) => (
  <>
    <ResearchBrainstorm prompt={prompt}>
      {topics => topics.map(topic => <PerformResearch topic={topic} />)}
    </ResearchBrainstorm>
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
        <WriteDraft
          research={[catalogResearch.join("\n"), webResearch.join("\n")].join(
            "\n\n",
          )}
          prompt={prompt}
        >
          {draft => <EditDraft draft={draft} />}
        </WriteDraft>
      );
    }}
  </ParallelResearch>
));

async function main() {
  console.log("🚀 Starting blog writing workflow");

  // Use the gensx function to execute the workflow and annotate with the output type.
  const result = await gsx.execute<BlogWritingWorkflowOutput>(
    <BlogWritingWorkflow prompt="Write a blog post about the future of AI" />,
  );
  console.log("✅ Final result:", { result });
}

await main();
```
