import { test as setup, type APIRequestContext } from "@playwright/test";

// Drives the real Auth.js Credentials callback flow for the test-agent provider (ADR-0066,
// ADR-0069). POST /api/auth/test-agent upserts a user but does not establish a session — a real
// session requires this CSRF + credentials-callback exchange.
//
// Two personas from the canonical seed dataset (scripts/seed-test-dataset.ts) are authenticated
// here, producing two separate storageState files:
// - coach-all-a: full mutation access to Org A's two groups (A1, A2) — the representative
//   default persona for smoke/accessibility/mutation-flow coverage.
// - viewer-a: read-only VIEWER role in Org A only — used by e2e/authz-failure.spec.ts to assert
//   real denial of both a role-restricted mutation and cross-organisation access (ADR-0078).

const NAMESPACE = process.env.TEST_AGENT_AUTH_NAMESPACE ?? "test-agent.matchboard.football";
// Auth.js's callback route is /api/auth/callback/<provider id>, not the generic "credentials" —
// src/auth.ts registers this provider with id: "test-agent" (confirmed via GET /api/auth/providers).
const CALLBACK_PATH = "/api/auth/callback/test-agent";

async function authenticateAndSaveState(
  request: APIRequestContext,
  email: string,
  storageStatePath: string,
): Promise<void> {
  const secret = process.env.TEST_AGENT_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "e2e/auth.setup.ts: TEST_AGENT_AUTH_SECRET is not set. This must match the deployed Test " +
        "environment's TEST_AGENT_AUTH_SECRET — see docs/development/browser-acceptance-testing.md.",
    );
  }

  const csrfResponse = await request.get("/api/auth/csrf");
  if (!csrfResponse.ok()) {
    throw new Error(
      `e2e/auth.setup.ts: GET /api/auth/csrf failed (${csrfResponse.status()}) — is the target ` +
        "environment reachable and running Auth.js?",
    );
  }
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  await request.post(CALLBACK_PATH, {
    form: { email, secret, csrfToken },
    // Auth.js issues a redirect on both success and failure; a non-2xx/3xx here would indicate
    // the endpoint itself is broken, not just a credential rejection, so let Playwright surface it.
  });

  const sessionResponse = await request.get("/api/auth/session");
  const session = (await sessionResponse.json()) as { user?: { email?: string } } | null;

  if (!session?.user?.email) {
    throw new Error(
      `e2e/auth.setup.ts: sign-in did not produce a session for ${email}. Most likely cause: ` +
        "TEST_AGENT_AUTH_SECRET doesn't match the target environment's secret, or " +
        "TEST_AGENT_AUTH_ENABLED is not set there. Refusing to save an unauthenticated storage state.",
    );
  }

  await request.storageState({ path: storageStatePath });
}

setup("authenticate as coach-all-a", async ({ request }) => {
  await authenticateAndSaveState(request, `coach-all-a@${NAMESPACE}`, "e2e/.auth/coach.json");
});

setup("authenticate as viewer-a", async ({ request }) => {
  await authenticateAndSaveState(request, `viewer-a@${NAMESPACE}`, "e2e/.auth/viewer.json");
});
