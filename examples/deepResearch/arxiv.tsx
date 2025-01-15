import { gsx } from "gensx";
import fetch from "node-fetch";
import { Parser } from "xml2js";

interface RawArxivEntry {
  title?: string[];
  summary?: string[];
  id?: string[];
  published?: string[];
  updated?: string[];
}

export interface ArxivEntry {
  title: string;
  summary: string;
  url: string;
  published: string;
  updated: string;
}

export interface ArxivSearchProps {
  queries: string[];
  maxResultsPerQuery?: number;
}

export const ArxivSearch = gsx.Component<ArxivSearchProps, ArxivEntry[]>(
  async ({ queries, maxResultsPerQuery = 10 }) => {
    const uniqueResults = new Map<string, ArxivEntry>();

    for (const query of queries) {
      const queryUrl = `http://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=${maxResultsPerQuery}`;

      const response = await fetch(queryUrl);
      const xml = await response.text();

      const parser = new Parser();
      const parsedResult = await parser.parseStringPromise(xml);

      const entries: ArxivEntry[] = (parsedResult.feed.entry || []).map(
        (entry: RawArxivEntry) => ({
          title: entry.title?.[0] ?? "",
          summary: entry.summary?.[0] ?? "",
          url: entry.id?.[0] ?? "",
          published: entry.published?.[0] ?? "",
          updated: entry.updated?.[0] ?? "",
        }),
      );

      // Add entries to map using URL as key to ensure uniqueness
      entries.forEach((entry) => {
        if (entry.url) {
          uniqueResults.set(entry.url, entry);
        }
      });
    }
    return Array.from(uniqueResults.values());
  },
);
