# Providers Example

This example shows how to create a provider and a related component. In particular, it creates a provider for the [Firecrawl](https://www.firecrawl.dev/) API and uses it to scrape a page and return the markdown.

For more details on providers, see the [Providers](https://gensx.dev/concepts/providers) page.

## Usage

```bash
# Install dependencies
pnpm install

# Set your Firecrawl API key
export FIRECRAWL_API_KEY=<your_api_key>

# Run the example
pnpm run run
```

When you run the example, it will scrape the page at `https://gensx.dev/overview/` and return the markdown.
