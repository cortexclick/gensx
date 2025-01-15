import { ChatCompletion } from "@gensx/openai";
import { gsx } from "gensx";

import { ArxivEntry } from "./arxiv.js";
import { Firecrawl } from "./firecrawl.js";

export interface SummarizePaperProps {
  markdown: string;
  prompt: string;
}

export const SummarizePaper = gsx.Component<SummarizePaperProps, string>(
  ({ markdown, prompt }) => {
    const systemMessage = `Your job is to provide a contextual research summary of a research summary based on the prompt provided.`;

    const userMessage = ` Here is the prompt:
      <prompt>
      ${prompt}
      </prompt>
      
      Here is the paper:
      <paper>
      ${markdown}
      </paper>
  
      Please return a detailed yet concise summary of the paper that is relevant to the user's prompt.`;
    return (
      <ChatCompletion
        model="gpt-4o-mini"
        messages={[
          {
            role: "system",
            content: systemMessage,
          },
          { role: "user", content: userMessage },
        ]}
      />
    );
  },
);

export interface FetchAndSummarizeProps {
  documents: ArxivEntry[];
  prompt: string;
}

export interface FetchAndSummarizeOutput {
  summaries: ArxivSummaries[];
}

export interface ArxivSummaries {
  url: string;
  title: string;
  summary: string;
}

export const FetchAndSummarize = gsx.Component<
  FetchAndSummarizeProps,
  FetchAndSummarizeOutput
>(({ documents, prompt }) => {
  console.log("Documents:", documents);
  return {
    summaries: documents.map((document) => {
      const url = document.url.replace("abs", "html");
      return {
        title: document.title,
        url: url,
        summary: (
          <Firecrawl url={url}>
            {(markdown: string | null) =>
              markdown && <SummarizePaper markdown={markdown} prompt={prompt} />
            }
          </Firecrawl>
        ),
      };
    }),
  };
});
