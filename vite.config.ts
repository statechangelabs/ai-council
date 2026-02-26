import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: resolve(__dirname, "src/electron/main.ts"),
        vite: {
          build: {
            outDir: resolve(__dirname, "dist-electron"),
            rollupOptions: {
              external: [
                "@anthropic-ai/sdk",
                "@google/generative-ai",
                "@google/genai",
                "openai",
                "ollama",
                "gray-matter",
                "glob",
                "dotenv",
                "dotenv/config",
                "zod",
              ],
            },
          },
        },
      },
      preload: {
        input: resolve(__dirname, "src/electron/preload.ts"),
        vite: {
          build: {
            outDir: resolve(__dirname, "dist-electron"),
          },
        },
      },
    }),
    renderer(),
  ],
  root: resolve(__dirname, "src/renderer"),
  build: {
    outDir: resolve(__dirname, "dist-renderer"),
    emptyOutDir: true,
  },
});
