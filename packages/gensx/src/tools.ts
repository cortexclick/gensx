import type { GsxComponent } from "./types";

import { z } from "zod";

import { Component } from "./component";

export interface GsxTool<Schema extends z.ZodType, Response> {
  name: string;
  schema: Schema;
  description?: string;
  function: (params: z.infer<Schema>) => Promise<Response>;
  toJSON: () => {
    name: string;
    description?: string;
    parameters: z.ZodSchema;
  };
}

type GsxToolComponent<Schema extends z.ZodType, Response> = GsxComponent<
  z.infer<Schema>,
  Response
> &
  GsxTool<Schema, Response>;

export function Tool<Schema extends z.ZodType, Response>(config: {
  name: string;
  schema: Schema;
  description?: string;
  function: (params: z.infer<Schema>) => Promise<Response>;
}): GsxToolComponent<Schema, Response> {
  const component = Component<z.infer<Schema>, Response>(
    config.name,
    async props => {
      // Validate props against schema
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const validatedProps = config.schema.parse(props);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return config.function(validatedProps);
    },
  );

  // Create a callable function that inherits from the component
  const tool = Object.assign(component, {
    schema: config.schema,
    description: config.description,
    function: config.function,
    toJSON: () => ({
      name: config.name,
      description: config.description,
      parameters: config.schema,
    }),
    getOpenApiSchema: () => ({
      name: config.name,
      description: config.description,
      parameters: config.schema,
    }),
  });

  return tool as GsxToolComponent<Schema, Response>;
}

// Re-export for backwards compatibility
export const createTool = Tool;
