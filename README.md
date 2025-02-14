# GenSX ⚡️

[![npm version](https://badge.fury.io/js/gensx.svg)](https://badge.fury.io/js/gensx)
[![Website](https://img.shields.io/badge/Visit-gensx.com-orange)](https://gensx.com)
[![Discord](https://img.shields.io/badge/Join-Discord-blue)](https://discord.gg/wRmwfz5tCy)
[![X](https://img.shields.io/badge/Follow-X-blue)](https://x.com/gensx_inc)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[GenSX](https://gensx.com/) is a simple typescript framework for building complex LLM applications. It's built around functional, reusable components that are composed to create and orchestrate workflows.

Designed for backend development, GenSX makes it easy to build and test powerful LLM workflows that can be turned into REST APIs or integrated into existing applications.

## Why GenSX?

- 🎯 **Pure Functions**: Components are pure TypeScript functions that are easily testable, reusable, and sharable
- 🌴 **Natural Composition**: Chain LLM calls using JSX - a familiar, visual syntax that reads top-to-bottom like normal code
- ⚡️ **Parallel by Default**: Components execute in parallel when possible while maintaining dependencies
- 🔒 **Type-safe**: Full TypeScript support with no DSLs or special syntax - just standard language features
- 🌊 **Streaming Built-in**: Stream responses with a single prop change, no refactoring needed
- 🚀 **Built for Scale**: Start simple and evolve to complex patterns like agents and reflection without changing your programming model

Check out the [documentation](https://gensx.com/overview) to learn more about building LLM applications with GenSX.

## Getting Started

To create a new GenSX project, run the following command:

```bash
npm create gensx@latest my-app
```

To add GenSX to an existing project, run the following command and follow the instructions described [here](https://www.npmjs.com/package/gensx):

```bash
npm install gensx @gensx/openai
```

Check out the [Quickstart Guide](https://gensx.com/quickstart) for more details on getting started.

## Building a workflow

Most LLM frameworks are graph oriented--you express your workflow with nodes, edges, and a global state object. GenSX takes a different approach--you compose your workflow with components, and GenSX handles the execution for you.

You start by defining your components:

```tsx
import { gsx } from "gensx";
import { OpenAIProvider, ChatCompletion } from "@gensx/openai";

// Define the input props and output type for type safety
interface CreateOutlineProps {
  prompt: string;
}
type CreateOutlineOutput = string;

// Create a reusable component that can be composed with others
const CreateOutline = gsx.Component<CreateOutlineProps, CreateOutlineOutput>(
  "CreateOutline",
  async ({ prompt }) => {
    return (
      <ChatCompletion
        model="gpt-4o-mini"
        messages={[
          {
            role: "user",
            content: `Create an outline for an article about ${prompt}`,
          },
        ]}
      />
    );
  },
);

interface WriteArticleProps {
  outline: string;
}
type WriteArticleOutput = string;

const WriteArticle = gsx.Component<WriteArticleProps, WriteArticleOutput>(
  "WriteArticle",
  async ({ outline }) => {
    return (
      <ChatCompletion
        model="gpt-4o-mini"
        messages={[
          {
            role: "user",
            content: `Use this outline to write a detailed article: ${outline}`,
          },
        ]}
      />
    );
  },
);
```

Then you can compose your components together to create a workflow:

```tsx
// Execute the workflow with the OpenAI provider
const result = await gsx.execute<string>(
  <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
    <CreateOutline prompt="the future of LLM dev tools">
      {(outline) => <WriteArticle outline={outline} />}
    </CreateOutline>
  </OpenAIProvider>,
);

console.log(result);
```

## Examples

This repo contains a number of [examples](./examples) to help you get up and running with GenSX.

### Basic Examples

| Example                                                 | Description                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| 📊 [Structured Outputs](./examples/structuredOutputs)   | Shows how to use structured outputs with GenSX                   |
| 🔄 [Reflection](./examples/reflection)                  | Shows how to use a self-reflection pattern with GenSX            |
| 🌊 [Streaming](./examples/streaming)                    | Shows how to handle streaming responses with GenSX               |
| 🗃️ [Contexts](./examples/contexts)                      | Shows how to use contexts to manage state in GenSX               |
| 🔌 [Providers](./examples/providers)                    | Shows how to create a custom provider for GenSX                  |
| 🎭 [Nested Providers](./examples/nestedProviders)       | Demonstrates how to nest and combine multiple providers in GenSX |
| 🧩 [Reusable Components](./examples/reusableComponents) | Shows how to create and use reusable components in GenSX         |

### Full Examples

| Example                                                  | Description                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 🔍 [Hacker News Analyzer](./examples/hackerNewsAnalyzer) | Analyzes HN posts and generates summaries and trends using Paul Graham's writing style       |
| ✍️ [Blog Writer](./examples/blogWriter)                  | Generates blogs through an end-to-end workflow including topic research and content creation |
| 🔬 [Deep Research](./examples/deepResearch)              | Generates a report from a prompt after researching and summarizing a list of research papers |

## Working with this repo

This monorepo contains GenSX, its related packages, examples, and documentation. You can find more detailed instructions in [CONTRIBUTING.md](./CONTRIBUTING.md).

### Repository Structure

- `packages/` - Published packages
- `examples/` - Example applications and use cases
- `docs` - `https://gensx.com` Documentation

## License

[Apache 2.0](./LICENSE)
