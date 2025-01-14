import { gsx } from "gensx";

import { BlogWritingWorkflow } from "./blogWriter.js";

async function main() {
  console.log("\n🚀 Starting blog writing workflow");
  const result = await gsx.execute<string>(
    <BlogWritingWorkflow
      prompt="Write a blog post about the future of AI"
    />,
  );
  console.log("\n✅ Blog writing complete");
  console.log(result);
}

main().catch(console.error);
