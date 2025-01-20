import { gsx } from "gensx";

import { FirecrawlProvider, ScrapePage } from "./firecrawlProvider.js";

async function main() {
  const url = "https://gensx.dev/overview/";

  console.log("\n🚀 Scraping page from url:", url);
  const markdown = await gsx.execute<string>(
    <FirecrawlProvider apiKey={process.env.FIRECRAWL_API_KEY}>
      <ScrapePage url={url} />
    </FirecrawlProvider>,
  );
  console.log("\n✅ Scraping complete");
  console.log("\n🚀 Scraped markdown:", markdown);
}

main().catch(console.error);
