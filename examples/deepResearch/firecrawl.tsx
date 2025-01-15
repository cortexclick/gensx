import FirecrawlApp from "@mendable/firecrawl-js";
import { gsx } from "gensx";

interface FirecrawlProps {
  url: string;
}

const firecrawlApp = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export const Firecrawl = gsx.Component<FirecrawlProps, string | null>(
  async ({ url }) => {
    const result = await firecrawlApp.scrapeUrl(url, {
      formats: ["markdown"],
      timeout: 30000,
    });
    if (!result.success) {
      return null;
    }
    return result.markdown;
  },
);
