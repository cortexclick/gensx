import ts from "typescript";
import path from "path";
import { createJsxNameTransformer } from "./jsx-name-transformer.js";

// Read the tsconfig.json
const configPath = ts.findConfigFile(
  process.cwd(),
  ts.sys.fileExists,
  "tsconfig.json",
);

if (!configPath) {
  throw new Error("Could not find a valid 'tsconfig.json'.");
}

// Parse the config
const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
if (error) {
  throw new Error(
    ts.formatDiagnostic(error, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: process.cwd,
      getNewLine: () => ts.sys.newLine,
    }),
  );
}

// Parse the config into compiler options
const {
  options: baseOptions,
  fileNames,
  errors,
} = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));

if (errors.length) {
  throw new Error(
    errors
      .map((e) =>
        ts.formatDiagnostic(e, {
          getCanonicalFileName: (fileName) => fileName,
          getCurrentDirectory: process.cwd,
          getNewLine: () => ts.sys.newLine,
        }),
      )
      .join("\n"),
  );
}

// Modify options to use JSX transformation with gensx runtime
const options: ts.CompilerOptions = {
  ...baseOptions,
  jsx: ts.JsxEmit.ReactJSX,
  jsxImportSource: "gensx",
};

// Create a program
const program = ts.createProgram(fileNames, options);

// Get transformers
const customTransformers: ts.CustomTransformers = {
  before: [],
  after: [createJsxNameTransformer()],
};

// Emit
const emitResult = program.emit(
  undefined, // no specific source file
  undefined, // default write file
  undefined, // no cancellation token
  undefined, // no emit only DTS files
  customTransformers,
);

// Report errors
const allDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .concat(emitResult.diagnostics);

if (allDiagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(allDiagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: process.cwd,
      getNewLine: () => ts.sys.newLine,
    }),
  );
  process.exit(1);
}

console.log("Compilation completed successfully!");
