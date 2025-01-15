import { ChatCompletion, OpenAIProvider } from "@gensx/openai";
import { gsx } from "gensx";

import { ArxivEntry, ArxivSearch } from "./arxiv.js";
import { GradeDocuments } from "./grader.js";
import { PromptToQuery } from "./promptToQuery.js";
import { FetchAndSummarize, FetchAndSummarizeOutput } from "./summarize.js";

interface FindResearchProps {
  prompt: string;
}

export const FindResearch = gsx.Component<FindResearchProps, ArxivEntry[]>(
  ({ prompt }) => (
    <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
      <PromptToQuery prompt={prompt}>
        {({ queries }) => {
          console.log("\n=== Search Queries ===");
          queries.forEach((query, i) => {
            console.log(`Query ${i + 1}: ${query}`);
          });

          return (
            <ArxivSearch queries={queries} maxResultsPerQuery={3}>
              {(documents: ArxivEntry[]) => {
                console.log(`\n=== Search Results ===`);
                console.log("Documents:", documents);
                return (
                  <GradeDocuments prompt={prompt} documents={documents}>
                    {(results) => {
                      return results.documents
                        .filter((result) => result.useful)
                        .map((result) => result.document);
                    }}
                  </GradeDocuments>
                );
              }}
            </ArxivSearch>
          );
        }}
      </PromptToQuery>
    </OpenAIProvider>
  ),
);

interface CreateReportProps {
  results: FetchAndSummarizeOutput;
  prompt: string;
}

export const CreateReport = gsx.Component<CreateReportProps, string>(
  ({ results, prompt }) => {
    const systemMessage = `You are an experienced researcher. You have summaries of relevant research papers. Write a report answering the user's prompt using the papers provided. Make sure to provide links to the relevant papers.`;

    const userMessage = `Here is the prompt:
    <prompt>
    ${prompt}
    </prompt>

    Here are the relevant research papers:
    ${results.summaries
      .map(
        (paper) => `
    <paper>
      <title>
        ${paper.title}
      </title>
      <url>
        ${paper.url}
      </url>
      <summary>
        ${paper.summary}
      </summary>
    </paper>`,
      )
      .join("\n")}
      
    Please write a report answering the user's prompt using the papers provided.`;

    return (
      <ChatCompletion
        model="gpt-4o"
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

interface DeepResearchProps {
  prompt: string;
}

export const DeepResearchWorkflow = gsx.Component<DeepResearchProps, string>(
  ({ prompt }) => {
    return (
      <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
        <FindResearch prompt={prompt}>
          {(output) => {
            return (
              <FetchAndSummarize documents={output} prompt={prompt}>
                {(summaries) => {
                  return <CreateReport results={summaries} prompt={prompt} />;
                }}
              </FetchAndSummarize>
            );
          }}
        </FindResearch>
      </OpenAIProvider>
    );
  },
);
