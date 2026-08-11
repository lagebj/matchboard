import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function resolveDirectUrl(): string {
  if (process.env.NODE_ENV === "test") {
    return env("TEST_DATABASE_DIRECT_URL") ?? env("TEST_DATABASE_URL") ?? env("DIRECT_URL") ?? env("DATABASE_URL");
  }
  return env("DIRECT_URL") ?? env("DATABASE_URL");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDirectUrl(),
  },
});