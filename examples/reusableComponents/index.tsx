import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { gsx } from "gensx";

import {
  DocumentProcessor,
  DocumentProcessorOutput,
} from "./reusableComponents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const gpt4oProviderConfig = {
    clientOptions: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    model: "gpt-4o",
  };

  const llama8bProviderConfig = {
    clientOptions: {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    },
    model: "llama-3.1-8b-instant",
  };

  const document = fs.readFileSync(
    path.join(__dirname, "data", "markov-chains.md"),
    "utf8",
  );

  const documentMetadata = await gsx.execute<DocumentProcessorOutput>(
    <DocumentProcessor
      document={document}
      defaultProvider={gpt4oProviderConfig}
      smallModelProvider={llama8bProviderConfig}
    />,
  );

  console.log(documentMetadata);
}

main().catch(console.error);
