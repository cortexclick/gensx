import { expect, suite, test } from "vitest";

import { gsx } from "@/index.js";

import { executeWithCheckpoints } from "./utils/executeWithCheckpoints";

// Test components
interface ArrayConfig {
  secretList: string[];
  mixedList: (string | { key: string })[];
  nestedArrays: string[][];
}

interface Config {
  apiKey?: string;
  template?: string;
  secret?: string;
  credentials?: {
    apiKey: string;
    metadata: {
      token: string;
      shortValue: string;
    };
  };
  message?: string;
}

const SecretComponent = gsx.Component<
  { config: Partial<Config> },
  Partial<Config>
>("SecretComponent", ({ config }) => config);

const SecondComponent = gsx.Component<{}, string>(
  "SecondComponent",
  () => {
    // Return raw values - masking happens at checkpoint level
    return [
      "123", // shortString - too short to mask
      "1234567", // barelyShort - too short to mask
      "12345678", // barelyLong - should be masked
      "123456789012", // definitelyLong - should be masked
      "456", // nested.short - too short to mask
      "long-secret-value", // nested.long - should be masked
    ].join(", ");
  },
  { secretOutputs: true }, // Mark the entire output as containing secrets
);

const ChildComponent = gsx.Component<
  { apiKey: string; additionalKey: string },
  string
>(
  "ChildComponent",
  ({ apiKey, additionalKey }) => `${apiKey}-${additionalKey}`,
  { secretProps: ["apiKey"] },
);

const ParentComponent = gsx.Component<
  { credentials: { key: string; other: string } },
  string
>(
  "ParentComponent",
  ({ credentials }) => (
    <ChildComponent
      apiKey={credentials.key}
      additionalKey={credentials.other}
      componentOpts={{
        secretProps: ["additionalKey"],
      }}
    />
  ),
  { secretProps: ["credentials"] },
);

const EdgeCaseComponent = gsx.Component<
  {
    config: {
      emptyString: string;
      nullValue: null;
      undefinedValue: undefined;
      actualSecret: string;
    };
  },
  string
>(
  "EdgeCaseComponent",
  ({ config }) =>
    JSON.stringify({
      empty: config.emptyString,
      secret: config.actualSecret,
    }),
  { secretProps: ["config"] },
);

const SpecialCharComponent = gsx.Component<
  { dotted: string; regex: string; unicode: string; url: string },
  string
>("SpecialCharComponent", (props) => Object.values(props).join(", "), {
  secretProps: ["dotted", "regex", "unicode", "url"],
});

const ArrayComponent = gsx.Component<{ config: ArrayConfig }, ArrayConfig>(
  "ArrayComponent",
  ({ config }) => config,
  { secretProps: ["config"] },
);

const ReuseComponent = gsx.Component<{}, string[]>(
  "ReuseComponent",
  () => {
    // Return raw values - masking happens at checkpoint level
    return [
      "secret.with.dots",
      "secret.*+?^\\{test\\}",
      "sēcrēt‿value",
      "https://api.example.com/secret?key=12345678",
      "unrelated-string",
    ];
  },
  { secretOutputs: true }, // Mark the entire output as containing secrets
);

const PartialComponent = gsx.Component<
  {
    prefix: string;
    suffix: string;
    middle: string;
    combined: string;
    unrelated: string;
  },
  string
>(
  "PartialComponent",
  ({ prefix, suffix, middle, combined, unrelated }) =>
    `${prefix} and ${suffix} and ${middle} and ${combined} and ${unrelated}`,
  { secretProps: ["prefix", "suffix", "middle", "combined"] },
);

const SecretStreamComponent = gsx.StreamComponent<{ apiKey: string }>(
  "SecretStreamComponent",
  ({ apiKey }) => {
    const stream = function* () {
      yield "Using API key: ";
      yield apiKey;
      yield "\nResponse: ";
      yield "not sensitive";
    };
    return stream();
  },
  { secretProps: ["apiKey"] }, // Mark both input and output as secret
);

suite("secrets", () => {
  test("collects secrets at registration time", async () => {
    const secretValue = "secret-api-key-12345";
    const { checkpoints, checkpointManager } = await executeWithCheckpoints<
      Partial<Config>
    >(
      <SecretComponent
        config={{ apiKey: secretValue }}
        componentOpts={{ secretProps: ["config.apiKey"] }}
      />,
    );

    // Get the raw node to verify secret collection

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    expect((checkpointManager as any).secretValues.has(secretValue)).toBe(true);

    // Verify raw value is stored
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const node = (checkpointManager as any).nodes.get(checkpoints[0].id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const nodeConfig = node?.props.config as Partial<Config>;
    expect(nodeConfig.apiKey).toBe(secretValue);

    // But checkpoint output is masked
    const checkpointConfig = checkpoints[0].props.config as Partial<Config>;
    expect(checkpointConfig.apiKey).toBe("[secret]");
  });

  test("preserves structure while masking secrets", async () => {
    const secretValue = "sk-1234567890";
    const message = `This message contains a secret ${secretValue} and some regular text`;
    const { checkpoints } = await executeWithCheckpoints(
      <SecretComponent
        config={{ message, secret: secretValue }}
        componentOpts={{ secretProps: ["config.secret"] }}
      />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    expect(finalCheckpoint.props.config).toEqual({
      message: "This message contains a secret [secret] and some regular text",
      secret: "[secret]",
    });
  });

  test("captures and reuses values from masked objects", async () => {
    const config = {
      credentials: {
        apiKey: "sk-1234567890",
        metadata: {
          token: "secret-token-12345",
          shortValue: "123", // Should not be masked due to length
        },
      },
    };

    const { checkpoints } = await executeWithCheckpoints<Partial<Config>>(
      <SecretComponent
        config={config}
        componentOpts={{ secretProps: ["config"] }}
      />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    const maskedConfig = finalCheckpoint.props.config as Config;

    // Verify structure is preserved but sensitive values are masked
    expect(maskedConfig).toEqual({
      credentials: {
        apiKey: "[secret]",
        metadata: {
          token: "[secret]",
          shortValue: "123", // Not masked due to length
        },
      },
    });

    // Test reuse of collected values in different shape
    const { checkpoints: reusedCheckpoints } = await executeWithCheckpoints<
      Partial<Config>
    >(
      <SecretComponent
        config={{
          credentials: {
            apiKey: "different-key",
            metadata: {
              token: "secret-token-12345", // Should be masked because value was captured
              shortValue: "123", // Should not be masked
            },
          },
        }}
        componentOpts={{ secretProps: ["config"] }}
      />,
    );

    const reusedFinalCheckpoint =
      reusedCheckpoints[reusedCheckpoints.length - 1];
    const reusedConfig = reusedFinalCheckpoint.props.config as Config;
    expect(reusedConfig.credentials?.metadata.token).toBe("[secret]");
    expect(reusedConfig.credentials?.metadata.shortValue).toBe("123");
  });

  test("captures and reuses values in string content", async () => {
    const apiKey = "sk-1234567890";
    const shortKey = "123"; // Should not be masked due to length

    const SecretComponent = gsx.Component<{ config: { key: string } }, string>(
      "SecretComponent",
      ({ config }) =>
        `Key is ${config.key} and reused here: ${config.key}, short: ${shortKey}`,
      { secretProps: ["config"] },
    );

    const { checkpoints } = await executeWithCheckpoints<string>(
      <SecretComponent
        config={{ key: apiKey }}
        componentOpts={{ secretProps: ["config"] }}
      />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    expect(finalCheckpoint.output).toBe(
      "Key is [secret] and reused here: [secret], short: 123",
    );
  });

  test("ignores values under minimum length threshold", async () => {
    interface Config {
      shortString: string;
      barelyShort: string;
      barelyLong: string;
      definitelyLong: string;
      nested: {
        short: string;
        long: string;
      };
    }

    const SecretComponent = gsx.Component<{ config: Config }, Config>(
      "SecretComponent",
      ({ config }) => config,
      { secretProps: ["config"] },
    );

    const config = {
      shortString: "123",
      barelyShort: "1234567",
      barelyLong: "12345678",
      definitelyLong: "123456789012",
      nested: {
        short: "456",
        long: "long-secret-value",
      },
    };

    const { checkpoints } = await executeWithCheckpoints<Config>(
      <SecretComponent
        config={config}
        componentOpts={{ secretProps: ["config"] }}
      />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    const maskedConfig = finalCheckpoint.props.config as Config;

    // Verify length-based masking while preserving structure
    expect(maskedConfig).toEqual({
      shortString: "123", // Too short
      barelyShort: "1234567", // Too short
      barelyLong: "[secret]", // Just long enough
      definitelyLong: "[secret]",
      nested: {
        short: "456", // Too short
        long: "[secret]",
      },
    });

    // Test reuse of values in different context
    const { checkpoints: secondCheckpoints } =
      await executeWithCheckpoints<string>(<SecondComponent />);

    const secondCheckpoint = secondCheckpoints[secondCheckpoints.length - 1];
    // Verify that the checkpoint contains masked values
    expect(secondCheckpoint.output).toBe("[secret]");
  });

  test("handles secrets through component composition", async () => {
    const credentials = {
      key: "parent-secret-key",
      other: "additional-secret",
    };

    const { checkpoints } = await executeWithCheckpoints<string>(
      <ParentComponent credentials={credentials} />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    const maskedCreds = finalCheckpoint.props.credentials;

    // Verify structure is preserved but values are masked
    expect(maskedCreds).toEqual({
      key: "[secret]",
      other: "[secret]",
    });

    // Find child component checkpoint
    const childCheckpoint = finalCheckpoint.children[0];
    expect(childCheckpoint.props.apiKey).toBe("[secret]");
    expect(childCheckpoint.props.additionalKey).toBe("[secret]");
    expect(childCheckpoint.output).toBe("[secret]-[secret]");
  });

  test("handles edge cases in secret values", async () => {
    const config = {
      emptyString: "",
      nullValue: null,
      undefinedValue: undefined,
      actualSecret: "actual-secret-value",
    };

    const { checkpoints } = await executeWithCheckpoints<string>(
      <EdgeCaseComponent config={config} />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    const maskedConfig = finalCheckpoint.props.config;

    // Verify structure preservation and proper handling of edge cases
    expect(maskedConfig).toEqual({
      emptyString: "", // Empty strings preserved
      nullValue: null, // Null preserved
      undefinedValue: undefined, // Undefined preserved
      actualSecret: "[secret]", // Only valid secrets masked
    });

    // Test reuse of values in different context
    const { checkpoints: secondCheckpoints } =
      await executeWithCheckpoints<string>(<SecondComponent />);

    const secondCheckpoint = secondCheckpoints[secondCheckpoints.length - 1];
    expect(secondCheckpoint.output).toBe("[secret]");
  });

  test("handles special characters in secrets", async () => {
    const config = {
      dotted: "secret.with.dots",
      regex: "secret.*+?^\\{test\\}",
      unicode: "sēcrēt‿value",
      url: "https://api.example.com/secret?key=12345678",
    };

    const { checkpoints } = await executeWithCheckpoints<string>(
      <SpecialCharComponent {...config} />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];

    // Verify structure preservation while masking special character values
    expect(finalCheckpoint.props).toEqual({
      dotted: "[secret]",
      regex: "[secret]",
      unicode: "[secret]",
      url: "[secret]",
    });

    // Test reuse in different string contexts
    const { checkpoints: reuseCheckpoints } = await executeWithCheckpoints<
      string[]
    >(<ReuseComponent />);

    const reuseCheckpoint = reuseCheckpoints[reuseCheckpoints.length - 1];
    // Verify that the checkpoint contains masked values
    expect(reuseCheckpoint.output).toEqual([
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]", // All values masked since entire output is marked as secret
    ]);
  });

  test("handles secrets in arrays and array elements", async () => {
    const config = {
      secretList: ["secret-one", "secret-two", "short"],
      mixedList: ["secret-three", { key: "secret-four" }, "short"],
      nestedArrays: [["secret-five"], ["secret-six", "short"]],
    };

    const { checkpoints } = await executeWithCheckpoints<ArrayConfig>(
      <ArrayComponent config={config} />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    const maskedConfig = finalCheckpoint.props.config;

    // Verify array structure preservation while masking values
    expect(maskedConfig).toEqual({
      secretList: ["[secret]", "[secret]", "short"],
      mixedList: ["[secret]", { key: "[secret]" }, "short"],
      nestedArrays: [["[secret]"], ["[secret]", "short"]],
    });

    // Test reuse of array values
    const { checkpoints: reuseCheckpoints } = await executeWithCheckpoints<
      string[]
    >(<ReuseComponent />);

    const reuseCheckpoint = reuseCheckpoints[reuseCheckpoints.length - 1];
    expect(reuseCheckpoint.output).toEqual([
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]", // All values masked since entire output is marked as secret
    ]);
  });

  test("handles partial string matching", async () => {
    const config = {
      prefix: "start-secret-prefix-value-end",
      suffix: "start-value-secret-suffix-end",
      middle: "start-before-secret-after-end",
      combined: "secret1-and-secret2-combined",
      unrelated: "unrelated-string",
    };

    const { checkpoints } = await executeWithCheckpoints<string>(
      <PartialComponent {...config} />,
    );

    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    const maskedConfig = finalCheckpoint.props;

    // Verify structure preservation while masking sensitive parts
    expect(maskedConfig).toEqual({
      prefix: "[secret]",
      suffix: "[secret]",
      middle: "[secret]",
      combined: "[secret]",
      unrelated: "unrelated-string",
    });

    // Test reuse in different context
    const { checkpoints: reuseCheckpoints } = await executeWithCheckpoints<
      string[]
    >(<ReuseComponent />);

    const reuseCheckpoint = reuseCheckpoints[reuseCheckpoints.length - 1];
    expect(reuseCheckpoint.output).toEqual([
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]",
    ]);
  });

  test("handles secrets in stream components", async () => {
    const apiKey = "sk-1234567890";
    // test non-streaming, with no output masking
    const { checkpoints, checkpointManager } =
      await executeWithCheckpoints<string>(
        <SecretStreamComponent apiKey={apiKey} />,
      );

    // Wait for any pending updates
    await checkpointManager.waitForPendingUpdates();

    const finalCheckpoint = checkpoints[checkpoints.length - 1];

    // Verify input is masked
    expect(finalCheckpoint.props.apiKey).toBe("[secret]");

    // Verify output is masked
    expect(finalCheckpoint.output).toBe(
      "Using API key: [secret]\nResponse: not sensitive",
    );

    // Test streaming mode with output masking
    const {
      result,
      checkpoints: streamingCheckpoints,
      checkpointManager: streamingManager,
    } = await executeWithCheckpoints<AsyncGenerator<string>>(
      <SecretStreamComponent
        apiKey={apiKey}
        stream={true}
        componentOpts={{ secretOutputs: true }}
      />,
    );

    for await (const _ of result) {
      // Wait for streaming to complete
    }

    // Wait for final checkpoint to complete
    await streamingManager.waitForPendingUpdates();

    const streamingFinal =
      streamingCheckpoints[streamingCheckpoints.length - 1];

    // Verify streaming output is also masked
    expect(streamingFinal.output).toBe("[secret]");
    expect(streamingFinal.props.apiKey).toBe("[secret]");
  });
});
