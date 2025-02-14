import rootConfig from "../../eslint.config.mjs";
import examplesConfig from "../eslint.config.mjs";

export default [
  ...rootConfig,
  ...examplesConfig,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: "./tsconfig.json",
      },
    },
  },
];
