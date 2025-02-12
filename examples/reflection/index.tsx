import { ChatCompletion, OpenAIProvider } from "@gensx/openai";
import { gsx } from "gensx";

import { createReflectionLoop, ReflectionOutput } from "./reflection.js";

const ImproveText = gsx.Component<{ input: string; feedback: string }, string>(
  "ImproveText",
  ({ input, feedback }) => {
    console.log("\n📝 Current draft:\n", input);
    console.log("\n🔍 Feedback:\n", feedback);
    console.log("=".repeat(50));
    const systemPrompt = `You're a helpful assistant that improves text by fixing typos, removing buzzwords, jargon, and making the writing sound more authentic.

    You will be given a piece of text and feedback on the text. Your job is to improve the text based on the feedback. You should return the improved text and nothing else.`;
    const prompt = `<feedback>
    ${feedback}
    </feedback>

    <text>
    ${input}
    </text>`;
    return (
      <ChatCompletion
        model="gpt-4o-mini"
        messages={[
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ]}
      />
    );
  },
);

const EvaluateText = gsx.Component<{ input: string }, ReflectionOutput>(
  "EvaluateText",
  ({ input }) => {
    const systemPrompt = `You're a helpful assistant that evaluates text and suggests improvements if needed.

    ## Evaluation Criteria

    - Check for genuine language: flag any buzzwords, corporate jargon, or empty phrases like "cutting-edge solutions"
    - Look for clear, natural expression: mark instances of flowery language or clichéd openers like "In today's landscape..."
    - Review word choice: highlight where simpler alternatives could replace complex or technical terms
    - Assess authenticity: note when writing tries to "sell" rather than inform clearly and factually
    - Evaluate tone: identify where the writing becomes overly formal instead of warm and conversational
    - Consider flow and engagement - flag where transitions feel choppy or content becomes dry and predictable


    ## Output Format
    Return your response as JSON with the following two properties:

    - feedback: A string describing the improvements that can be made to the text. Return feedback as short bullet points. If no improvements are needed, return an empty string.
    - continueProcessing: A boolean indicating whether the text should be improved further. If no improvements are needed, return false.

    You will be given a piece of text. Your job is to evaluate the text and return a JSON object with the following format:
    {
      "feedback": "string",
      "continueProcessing": "boolean"
    }
    `;
    return (
      <ChatCompletion
        model="gpt-4o-mini"
        messages={[
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ]}
        response_format={{ type: "json_object" }}
      >
        {(response: string) => {
          return JSON.parse(response) as ReflectionOutput;
        }}
      </ChatCompletion>
    );
  },
);

export const ImproveTextWithReflection = gsx.Component<
  {
    text: string;
    maxIterations?: number;
  },
  string
>("ImproveTextWithReflection", ({ text, maxIterations = 3 }) => {
  const Reflection = createReflectionLoop<string>("ImproveTextWithReflection");
  return (
    <Reflection
      input={text}
      ImproveFn={ImproveText}
      EvaluateFn={EvaluateText}
      maxIterations={maxIterations}
    />
  );
});

async function main() {
  const text = `We are a cutting-edge technology company leveraging bleeding-edge AI solutions to deliver best-in-class products to our customers. Our agile development methodology ensures we stay ahead of the curve with paradigm-shifting innovations.

Our mission-critical systems utilize cloud-native architectures and next-generation frameworks to create synergistic solutions that drive digital transformation. By thinking outside the box, we empower stakeholders with scalable and future-proof applications that maximize ROI.

Through our holistic approach to disruptive innovation, we create game-changing solutions that move the needle and generate impactful results. Our best-of-breed technology stack combined with our customer-centric focus allows us to ideate and iterate rapidly in this fast-paced market.`;

  const improvedText = await gsx.execute<string>(
    <OpenAIProvider apiKey={process.env.OPENAI_API_KEY}>
      <ImproveTextWithReflection text={text} />
    </OpenAIProvider>,
  );

  console.log("🎯 Final text:\n", improvedText);
}

main().catch(console.error);
