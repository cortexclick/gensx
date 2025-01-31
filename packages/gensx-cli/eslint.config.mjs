import rootConfig from "../../eslint.config.mjs";

export default [
  {
    ignores: ["**/coverage/**"],
  },
  ...rootConfig,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
