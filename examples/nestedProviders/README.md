# Nested Providers Example

This example shows how to use multiple OpenAI compatible providers in the same workflow. It uses an OpenAI model to write a tutorial and then a Groq model to rewrite the tutorial.

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

When you run the example, you'll see both the original tutorial and the rewritten tutorial.
