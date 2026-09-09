import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

/** Copies manifest.json into dist/ on every build. Icons ride along via public/. */
function manifest() {
  return {
    name: "gloss:manifest",
    generateBundle() {
      // @ts-expect-error - rollup plugin context
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: readFileSync(resolve(import.meta.dirname, "manifest.json"), "utf8"),
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [preact(), manifest()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // esnext keeps the bundler from injecting helper functions into
    // captureSelection(), which must stay self-contained to survive
    // serialization into the page by chrome.scripting.executeScript.
    target: "esnext",
    sourcemap: mode === "development",
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, "sidepanel.html"),
        options: resolve(import.meta.dirname, "options.html"),
        background: resolve(import.meta.dirname, "src/background/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
}));
