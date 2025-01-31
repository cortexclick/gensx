import { resolve } from "path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig(({ command }) => ({
  build: {
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "jsx-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
        "jsx-dev-runtime": resolve(__dirname, "src/jsx-dev-runtime.ts"),
        "run-cli": resolve(__dirname, "src/run-cli.ts"),
      },
      formats: ["es"],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: id => !id.startsWith(".") && !id.startsWith("/"),
    },
    watch: command === "serve" ? {} : undefined,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  plugins: [
    dts({
      include: ["src"],
      outDir: "dist",
      rollupTypes: true,
      afterDiagnostic: diagnostics => {
        if (diagnostics.length) {
          throw new Error("Compile failure");
        }
      },
    }),
  ],
}));
