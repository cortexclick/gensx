# Deep Research Example

This example demonstrates how to use GenSX to create an AI-powered deep research workflow.

The workflow starts with a prompt and then goes through the following steps to generate a research report:

1. Converts the prompt into a series of queries
2. Uses the [Arxiv API](https://arxiv.org/help/api/user-manual) to retrieve relevant research papers
3. Determines if the papers are relevant to the prompt
4. Scrapes the full text of the relevant papers using the [Firecrawl API](https://www.firecrawl.dev/)
5. Summarizes the relevant parts of the papers
6. Uses the summaries to generate a research report

## What it demonstrates

- Complex AI workflow orchestration using GenSX
- Integration with external APIs (ArXiv and Firecrawl)
- Multi-step document processing and analysis

## Prerequisites

You'll need the following API keys to run this example:

- [Firecrawl API Key](https://www.firecrawl.dev/)
- [OpenAI API Key](https://platform.openai.com/)

## Usage

```bash
# Install dependencies
pnpm install

# Run the example
FIRECRAWL_API_KEY=your_api_key OPENAI_API_KEY=your_api_key npm run run
```
