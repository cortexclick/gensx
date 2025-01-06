export default {
  extends: ["../../.eslintrc.json"],
  parserOptions: {
    tsconfigRootDir: import.meta.dirname,
    project: "./tsconfig.json",
  },
  rules: {
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "node/no-unsupported-features/es-syntax": "off",
  },
};
