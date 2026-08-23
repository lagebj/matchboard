import { defineConfig } from "vitest/config";

/**
 * Plain Vitest config for this Worker's pure logic (`state.ts`, `auth.ts` helpers, `rpc.ts`).
 * Deliberately separate from the root `vitest.config.ts` (which requires `TEST_DATABASE_URL`
 * and targets `src/**` only) — none of these tests touch a database or need Next.js's test
 * environment. Does NOT exercise the actual `MatchSessionObject`/Worker `fetch` handler in a
 * real Workers runtime (no `@cloudflare/vitest-pool-workers`/Miniflare here) — see
 * `docs/development/live-match-realtime.md` for why that gap is accepted for Stage 3.
 */
export default defineConfig({
  // Vitest resolves `include` relative to the process CWD, not this config file's
  // directory, unless `root` is set explicitly — needed since the root `npm run test:workers`
  // script invokes this config from the repository root, not from `workers/live-match/`.
  root: import.meta.dirname,
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
