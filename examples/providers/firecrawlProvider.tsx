import FirecrawlApp, { FirecrawlAppConfig } from "@mendable/firecrawl-js";
import { gsx } from "gensx";

// Create a context
export const FirecrawlContext = gsx.createContext<{
  client?: FirecrawlApp;
}>({});

// Create the provider
export const FirecrawlProvider = gsx.Component<FirecrawlAppConfig, never>(
  "FirecrawlProvider",
  (args: FirecrawlAppConfig) => {
    const client = new FirecrawlApp({
      apiKey: args.apiKey,
    });
    return <FirecrawlContext.Provider value={{ client }} />;
  },
);

interface ScrapePageProps {
  url: string;
}

// Create a component that uses the provider
export const ScrapePage = gsx.Component<ScrapePageProps, string>(
  "ScrapePage",
  async ({ url }) => {
    const context = gsx.useContext(FirecrawlContext);

    if (!context.client) {
      throw new Error(
        "Firecrawl client not found. Please wrap your component with FirecrawlProvider.",
      );
    }
    const result = await context.client.scrapeUrl(url, {
      formats: ["markdown"],
      timeout: 30000,
    });

    if (!result.success || !result.markdown) {
      throw new Error(`Failed to scrape url: ${url}`);
    }

    return result.markdown;
  },
);
