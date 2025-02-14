# Reusable Components Example

This example shows how to create reusable components and workflows that can be used with different models and providers. For more details on building reusable components, see the [docs on building reusable components](https://gensx.com/concepts/reusable-components).

In particular, this example creates a `DocumentProcessor` component that supports a config for a default model and a small model and uses those providers to process a document and extract metadata from it.

## Usage

```bash
# Install dependencies
pnpm install

# Set your API keys
export OPENAI_API_KEY=<your_api_key>
export GROQ_API_KEY=<your_api_key>

# Run the example
pnpm run start
```

When you run the example, it will process the `markov-chains.md` file and output a brief summary, a list of keywords, and a category for the document.
