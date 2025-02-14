import { gsx } from "gensx";

import { TutorialWriterWithEditorial } from "./nestingProviders.js";

async function main() {
  console.log("\n🚀 Starting the tutorial writing workflow...");
  const tutorial = await gsx.execute<string>(
    <TutorialWriterWithEditorial subject="visualizing data with matplotlib" />,
  );
  console.log("\n✅ Rewritten tutorial from Groq:\n", tutorial);
}

main().catch(console.error);
