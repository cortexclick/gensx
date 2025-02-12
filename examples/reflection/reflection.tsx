import { gsx, GsxComponent } from "gensx";

export interface ReflectionOutput {
  feedback: string;
  continueProcessing: boolean;
}

interface ReflectionProps<TInput> {
  // The initial input to process
  input: TInput;
  // Component to process the input and generate new output
  ImproveFn: GsxComponent<{ input: TInput; feedback: string }, TInput>;
  // Component to evaluate if we should continue processing and provide feedback
  EvaluateFn: GsxComponent<{ input: TInput }, ReflectionOutput>;
  // Current iteration count
  iterations?: number;
  // Maximum number of iterations allowed
  maxIterations?: number;
}

/**
 * A generic component for implementing reflection-based processing.
 * It will continue processing the input until either:
 * 1. the evaluate function returns false
 * 2. maxIterations is reached
 */
export function createReflectionLoop<TInput>(name: string) {
  return gsx.Component<ReflectionProps<TInput>, TInput>(
    name,
    async ({
      input,
      ImproveFn,
      EvaluateFn,
      iterations = 0,
      maxIterations = 3,
    }) => {
      // Check if we should continue processing
      const { feedback, continueProcessing } =
        await gsx.execute<ReflectionOutput>(<EvaluateFn input={input} />);

      if (continueProcessing && iterations < maxIterations) {
        // Process the input
        const newInput: TInput = await gsx.execute<TInput>(
          <ImproveFn input={input} feedback={feedback} />,
        );

        // Recursive call with updated input and iteration count
        const Reflection = createReflectionLoop<TInput>(
          `${name}-${iterations + 1}`,
        );
        return (
          <Reflection
            input={newInput}
            ImproveFn={ImproveFn}
            EvaluateFn={EvaluateFn}
            iterations={iterations + 1}
            maxIterations={maxIterations}
          />
        );
      }

      // Return the final input when we're done processing
      return input;
    },
  );
}
