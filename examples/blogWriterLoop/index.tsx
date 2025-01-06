import { execute } from "gensx";

import { BlogWritingLoopWorkflow } from "./loop.js";

async function main() {
  const prompt = "Write a blog post about performance optimization in MongoDB";
  const response = await execute<string>(
    <BlogWritingLoopWorkflow prompt={prompt} />,
  );
  console.log(response);
}

main().catch(console.error);
