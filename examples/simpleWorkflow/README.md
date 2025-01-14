# Hacker News Analyzer Example

This example demonstrates how to use GenSX to create a workflow that analyzes Hacker News posts. It shows how to combine data fetching, analysis, and content generation in a single workflow.

## What it demonstrates

- Fetching external data (from Hacker News API)
- Complex workflow processing with multiple steps
- Generating both a detailed report and a concise tweet
- Writing output to files

## Usage

```bash
# Install dependencies
pnpm install

# Run the example
pnpm run run
```

The example will:

1. Fetch the latest 500 HN posts
2. Analyze the content
3. Generate two files:
   - `hn_analysis_report.md`: A detailed analysis report
   - `hn_analysis_tweet.txt`: A tweet-sized summary of the analysis
