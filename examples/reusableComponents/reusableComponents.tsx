import { ChatCompletion, OpenAIProvider } from "@gensx/openai";
import { gsx } from "gensx";
import { ClientOptions } from "openai";

interface ProviderConfig {
  clientOptions: ClientOptions;
  model: string;
}

interface DocumentSummarizerProps {
  document: string;
  provider: ProviderConfig;
}

const DocumentSummarizer = gsx.Component<DocumentSummarizerProps, string>(
  "DocumentSummarizer",
  ({ document, provider }) => (
    <OpenAIProvider {...provider.clientOptions}>
      <ChatCompletion
        model={provider.model}
        messages={[
          {
            role: "user",
            content: `Please create a high level summary of the following document targeting 30 words:\n\n <document>${document}</document>`,
          },
        ]}
      />
    </OpenAIProvider>
  ),
);

interface KeywordsExtractorProps {
  document: string;
  provider: ProviderConfig;
}

const KeywordsExtractor = gsx.Component<KeywordsExtractorProps, string[]>(
  "KeywordsExtractor",
  ({ document, provider }) => (
    <OpenAIProvider {...provider.clientOptions}>
      <ChatCompletion
        model={provider.model}
        messages={[
          {
            role: "user",
            content: `Please return a comma separated list of key words from the following document:

            <document>${document}</document>

            Aim for 5-10 keywords. Do not include any other text in your response besides the list of keywords.`,
          },
        ]}
      >
        {(response) => response.split(",").map((phrase) => phrase.trim())}
      </ChatCompletion>
    </OpenAIProvider>
  ),
);

interface CategoryClassifierProps {
  document: string;
  provider: ProviderConfig;
}

const CategoryClassifier = gsx.Component<CategoryClassifierProps, string>(
  "CategoryClassifier",
  ({ document, provider }) => (
    <OpenAIProvider {...provider.clientOptions}>
      <ChatCompletion
        model={provider.model}
        messages={[
          {
            role: "user",
            content: `Please analyze the following document and return a category for it. The category should be one of the following: 'technology', 'business', 'science', 'health', 'politics', 'entertainment', 'other'.

            <document>${document}</document>

            Do not include any other text in your response besides the category.`,
          },
        ]}
      />
    </OpenAIProvider>
  ),
);

interface DocumentProcessorProps {
  document: string;
  defaultProvider: ProviderConfig;
  smallModelProvider?: ProviderConfig;
}

export interface DocumentProcessorOutput {
  summary: string;
  keywords: string[];
  category: string;
}

export const DocumentProcessor = gsx.Component<
  DocumentProcessorProps,
  DocumentProcessorOutput
>("DocumentProcessor", (props) => {
  const smallModelProvider = props.smallModelProvider ?? props.defaultProvider;
  return {
    summary: (
      <DocumentSummarizer
        document={props.document}
        provider={props.defaultProvider}
      />
    ),
    keywords: [
      <KeywordsExtractor
        document={props.document}
        provider={smallModelProvider}
      />,
    ],
    category: (
      <CategoryClassifier
        document={props.document}
        provider={smallModelProvider}
      />
    ),
  };
});
