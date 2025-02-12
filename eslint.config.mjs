import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import eslintPluginN from "eslint-plugin-n";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginVitest from "eslint-plugin-vitest";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/vite.config.ts.timestamp*",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: {
      "@typescript-eslint": tseslint,
      "simple-import-sort": eslintPluginSimpleImportSort,
      prettier: eslintPluginPrettier,
      n: eslintPluginN,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      ...prettierConfig.rules,
      ...eslintPluginN.configs.recommended.rules,
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "n/no-missing-import": "off",
      "n/no-unsupported-features/es-syntax": [
        "error",
        {
          ignores: ["modules", "dynamicImport", "restSpreadProperties"],
        },
      ],
      "n/no-unsupported-features/es-builtins": [
        "error",
        {
          version: ">=18.0.0",
        },
      ],
      "n/no-unpublished-import": "off",
      "no-process-exit": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint,
      "simple-import-sort": eslintPluginSimpleImportSort,
      prettier: eslintPluginPrettier,
      vitest: eslintPluginVitest,
      n: eslintPluginN,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./packages/*/tsconfig.json",
      },
    },
    rules: {
      ...tseslint.configs["strict-type-checked"].rules,
      ...tseslint.configs["stylistic-type-checked"].rules,
      ...prettierConfig.rules,
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            [
              "^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib|freelist|v8|process|async_hooks|http2|perf_hooks)(/.*|$)",
            ],
            [
              "^node:.*\\u0000$",
              "^@?\\w.*\\u0000$",
              "^[^.].*\\u0000$",
              "^\\..*\\u0000$",
            ],
            ["^\\u0000"],
            ["^node:"],
            ["^@?\\w"],
            ["^@/tests(/.*|$)"],
            ["^@/src(/.*|$)"],
            ["^"],
            ["^\\."],
          ],
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "vitest/valid-expect": "error",
      "vitest/valid-title": "error",
      "vitest/no-focused-tests": "error",
      "vitest/no-identical-title": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/expect-expect": "off",
      "vitest/no-standalone-expect": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
