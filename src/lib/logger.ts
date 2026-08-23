import pino from "pino";
import { isProduction, isTest } from "@/lib/env";
import { getCorrelationId } from "@/lib/logging/correlation-context";

// Structured logging (platform-integrity-programme Phase 7). Replaces raw console.* calls in
// Node-runtime server code (server actions, API routes, db/security/policy/email libs) with
// structured JSON output carrying a correlationId set once at the request/action boundary
// (requireActorContext()). Deliberately NOT used from src/lib/env.ts (imported by
// src/middleware.ts, which runs on the Edge Runtime — pino depends on Node.js streams and does
// not work there) or from client components (src/app/global-error.tsx runs in the browser).
export function correlationMixin(): Record<string, string> {
  const correlationId = getCorrelationId();
  return correlationId ? { correlationId } : {};
}

export const logger = pino({
  // Silent by default under the test runner so structured log lines don't clutter test output —
  // tests that need to assert on a log call read `logger.*` calls directly (Vitest spies), not
  // stdout. Explicit LOG_LEVEL always wins.
  level: process.env.LOG_LEVEL ?? (isTest() ? "silent" : isProduction() ? "info" : "debug"),
  mixin: correlationMixin,
});
