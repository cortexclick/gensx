import { ChatOpenAI } from "@langchain/openai";
import { Component } from "gensx";
import { z } from "zod";

const llm = new ChatOpenAI({
  model: "gpt-4o",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const WriteBlogOutlineStep = Component<{ prompt: string }, string>(
  async ({ prompt }: { prompt: string }) => {
    console.log("prompt", prompt);
    const outlinePrompt = `Write a blog post outline for the following prompt: ${prompt}`;
    const result = await llm.invoke(outlinePrompt);
    return result.content;
  },
);

const WriteBlogStep = Component<{ outline: string }, string>(
  async ({ outline }: { outline: string }) => {
    console.log("outline", outline);
    const prompt = `Write a blog post based on the following outline: ${outline}`;
    const result = await llm.invoke(prompt);
    console.log("Blog result:", result.content);
    return result.content;
  },
);

const EvaluateAIWordsStep = Component<
  { blog: string },
  { aiWords: string[]; removalPrompt: string }
>(async ({ blog }: { blog: string }) => {
  console.log("Evaluating AI words blog", blog);
  const schema = z.object({
    aiWords: z
      .array(z.string())
      .describe(
        "Words or phrases that sound artificially generated or unnatural",
      ),
    removalPrompt: z
      .string()
      .describe(
        "A prompt that lists the identified AI sounding words/phrases and explains how to naturally rephrase them in a more conversational way so that if fixed, the text would sound more natural.",
      ),
  });

  const result = await llm.withStructuredOutput(schema).invoke([
    {
      role: "system",
      content:
        "Analyze the text and identify words/phrases that sound AI generated. It could be the case that there are none, in that case, return an empty array. But be sure to check for them and then create a specific prompt that lists these each on a new line and explains how to naturally rephrase them in a more conversational way so that if fixed, the text would sound more natural.",
    },
    { role: "user", content: blog },
  ]);

  console.log("result", result);
  return result;
});

const RemoveAIWordsStep = Component<
  { blog: string; aiWords: string[]; removalPrompt: string },
  string
>(async ({ blog, aiWords, removalPrompt }) => {
  console.log("Removing AI words:", aiWords, removalPrompt);
  const systemPrompt = `You are an expert at content that doesn't sound AI generated. You are given a blog post and a prompt to remove AI sounding words/phrases. Follow the prompt to remove the words/phrases and return the modified blog post.`;
  const prompt = `${removalPrompt}\n\nHere's the blog to improve:\n${blog}`;
  const result = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ]);
  return result.content;
});

function Loop<I, O>(
  evaluateFn: (input: I) => Promise<[boolean, O]>,
  improveFn: (input: O) => Promise<I>,
  maxCycles = 3,
) {
  return Component<{ input: I }, I>(
    async ({ input }: { input: I }): Promise<I> => {
      // Evaluate
      const [shouldContinue, evaluateResult] = await evaluateFn(input);

      // Bail out if no need to continue or we've hit our limit
      if (!shouldContinue || maxCycles <= 0) {
        return input;
      }

      // Improve the content
      const improved = await improveFn(evaluateResult);

      // Recursively run the loop with improved input
      return Loop<I, O>(
        evaluateFn,
        improveFn,
        maxCycles - 1,
      )({
        input: improved,
      });
    },
  );
}

const AIWordsRemovalLoop = Loop<
  string,
  { blog: string; aiWords: string[]; removalPrompt: string }
>(
  // Evaluate
  async (
    currentBlog: string,
  ): Promise<
    [boolean, { blog: string; aiWords: string[]; removalPrompt: string }]
  > => {
    const response = (
      <EvaluateAIWordsStep blog={currentBlog}>
        {(result) => {
          console.log("Evaluate result", result);
          return [
            result.aiWords.length > 0,
            {
              blog: currentBlog,
              aiWords: result.aiWords,
              removalPrompt: result.removalPrompt,
            },
          ];
        }}
      </EvaluateAIWordsStep>
    );
    return response as Promise<
      [boolean, { blog: string; aiWords: string[]; removalPrompt: string }]
    >;
  },
  // Improve
  async (result): Promise<string> => {
    console.log("Removing AI words", result);
    const response = (
      <RemoveAIWordsStep
        blog={result.blog}
        aiWords={result.aiWords}
        removalPrompt={result.removalPrompt}
      />
    );
    return response as Promise<string>;
  },
  3,
);

export const BlogWritingLoopWorkflow = Component<{ prompt: string }, string>(
  async ({ prompt }: { prompt: string }) => (
    <WriteBlogOutlineStep prompt={prompt}>
      {(outline: string) => (
        <WriteBlogStep outline={outline}>
          {(blog: string) => <AIWordsRemovalLoop input={blog} />}
        </WriteBlogStep>
      )}
    </WriteBlogOutlineStep>
  ),
);
