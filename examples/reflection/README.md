# Self-reflection Example

This example demonstrates how to use GenSX to implement self-reflection for LLMs using `gsx.execute` and recursive component execution. It implements a self-reflection loop to improve the quality of AI generated text. Learn more in the [self-reflection docs](https://gensx.com/patterns/reflection).

## Usage

```bash
# Install dependencies
pnpm install

# Set your OpenAI API key
export OPENAI_API_KEY=<your_api_key>

# Run the example
pnpm run start
```

The example will clean a sample text containing buzzwords and jargon. You can modify the input text in `index.tsx` to clean different content.
