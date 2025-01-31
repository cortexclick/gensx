import { resolve } from "path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig(({ command }) => ({
  build: {
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        run: resolve(__dirname, "src/run.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("/"),
    },
    watch: command === "serve" ? {} : undefined,
  },
  plugins: [
    dts({
      include: ["src"],
      outDir: "dist",
      rollupTypes: true,
      afterDiagnostic: (diagnostics) => {
        if (diagnostics.length) {
          throw new Error("Compile failure");
        }
      },
    }),
  ],
}));
