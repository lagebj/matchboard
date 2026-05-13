import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup-component.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      BYPASS_AUTH: "true",
    },
  },
});