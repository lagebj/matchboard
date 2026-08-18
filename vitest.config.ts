import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must be set before running tests. Refusing to fall back to DATABASE_URL which may point to a production database. Set TEST_DATABASE_URL in .env or your shell environment.",
  );
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      MATCHBOARD_ENV: "test",
      TEST_AGENT_AUTH_ENABLED: "true",
      TEST_AGENT_AUTH_SECRET: "test-agent-secret-for-vitest-only",
    },
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },
  },
});