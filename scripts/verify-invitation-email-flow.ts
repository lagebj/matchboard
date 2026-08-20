/**
 * Live invitation-email verification against the deployed Test environment
 * (consolidation programme §29, Phase 4). Drives the full flow end-to-end against a real
 * deployment, using only public HTTP/browser interfaces — no direct database access:
 *
 *   authenticate as owner-a
 *     -> create an invitation via the real UI
 *     -> correlate the real Brevo message (getTransacEmailsList + getTransacEmailContent)
 *     -> extract the accept URL from its actual rendered content
 *     -> authenticate as the newly invited dynamic identity (programme §22)
 *     -> accept via the real UI
 *     -> verify resulting access
 *
 * Requires: BREVO_API_KEY, TEST_AGENT_AUTH_SECRET (matching the deployed Test app's secret).
 * Refuses to run against anything that looks like Production.
 *
 * Usage:
 *   BREVO_API_KEY=... TEST_AGENT_AUTH_SECRET=... npx tsx scripts/verify-invitation-email-flow.ts
 */

import { chromium, request as playwrightRequest } from "@playwright/test";
import { BrevoClient } from "@getbrevo/brevo";

const BASE_URL = process.env.TARGET_BASE_URL ?? "https://test.matchboard.football";
const NAMESPACE = process.env.TEST_AGENT_AUTH_NAMESPACE ?? "test-agent.matchboard.football";
const INVITER_EMAIL = `owner-a@${NAMESPACE}`;
const ORG_SLUG = process.env.TARGET_ORG_SLUG ?? "test-club-a";
const INVITEE_EMAIL = process.env.INVITEE_EMAIL ?? `invited-test@${NAMESPACE}`;
const CORRELATION_POLL_ATTEMPTS = 15;
const CORRELATION_POLL_INTERVAL_MS = 2000;

function assertSafeTarget(url: string): void {
  if (url.includes("app.matchboard.football")) {
    throw new Error("Refusing to run against Production (app.matchboard.football).");
  }
}

async function authenticate(email: string, secret: string) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const csrfRes = await api.get("/api/auth/csrf");
    if (!csrfRes.ok()) {
      throw new Error(`GET /api/auth/csrf failed (${csrfRes.status()}) — is ${BASE_URL} reachable?`);
    }
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await api.post("/api/auth/callback/test-agent", {
      form: { email, secret, csrfToken },
    });

    const sessionRes = await api.get("/api/auth/session");
    const session = (await sessionRes.json()) as { user?: { email?: string } } | null;
    if (!session?.user?.email) {
      throw new Error(
        `Sign-in did not produce a session for ${email}. Check TEST_AGENT_AUTH_SECRET matches the deployed Test app's secret.`,
      );
    }

    return await api.storageState();
  } finally {
    await api.dispose();
  }
}

async function findLatestBrevoMessage(brevo: BrevoClient, email: string) {
  for (let attempt = 1; attempt <= CORRELATION_POLL_ATTEMPTS; attempt++) {
    const list = await brevo.transactionalEmails.getTransacEmailsList({ email, limit: 1 });
    const latest = list.transactionalEmails?.[0];
    if (latest) return latest;
    console.log(
      `  (no message found yet for ${email}, attempt ${attempt}/${CORRELATION_POLL_ATTEMPTS} — outbox dispatch is fire-and-forget, retrying)`,
    );
    await new Promise((r) => setTimeout(r, CORRELATION_POLL_INTERVAL_MS));
  }
  throw new Error(
    `No Brevo transactional email found for ${email} after ${CORRELATION_POLL_ATTEMPTS} attempts.`,
  );
}

async function main() {
  assertSafeTarget(BASE_URL);

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) throw new Error("BREVO_API_KEY is not set.");
  const testAgentSecret = process.env.TEST_AGENT_AUTH_SECRET;
  if (!testAgentSecret) throw new Error("TEST_AGENT_AUTH_SECRET is not set.");

  console.log(`Target: ${BASE_URL}`);
  console.log(`Org: ${ORG_SLUG}`);
  console.log(`Invitee: ${INVITEE_EMAIL}\n`);

  console.log(`== Step 1: authenticate as ${INVITER_EMAIL} ==`);
  const inviterState = await authenticate(INVITER_EMAIL, testAgentSecret);

  const browser = await chromium.launch();
  try {
    const inviterContext = await browser.newContext({ baseURL: BASE_URL, storageState: inviterState });
    const inviterPage = await inviterContext.newPage();

    console.log(`== Step 2: create invitation for ${INVITEE_EMAIL} via the real UI ==`);
    await inviterPage.goto(`/o/${ORG_SLUG}`);
    await inviterPage.getByRole("button", { name: "Invite member" }).click();
    await inviterPage.getByPlaceholder("coach@example.com").fill(INVITEE_EMAIL);
    await inviterPage.getByRole("button", { name: "Send invitation" }).click();
    // Success collapses the form back to the "Invite member" button (org-detail-client.tsx).
    await inviterPage.getByRole("button", { name: "Invite member" }).waitFor({ timeout: 15000 });
    console.log("  Invitation created.");
    await inviterContext.close();

    console.log("\n== Step 3: correlate the real Brevo message ==");
    const brevo = new BrevoClient({ apiKey: brevoApiKey });
    const latest = await findLatestBrevoMessage(brevo, INVITEE_EMAIL);
    console.log(`  Found message: uuid=${latest.uuid} sentAt=${latest.date} subject="${latest.subject}"`);
    if (!latest.subject.startsWith("[TEST]")) {
      throw new Error(`Expected a [TEST]-prefixed subject (ADR-0076), got: "${latest.subject}"`);
    }

    const content = await brevo.transactionalEmails.getTransacEmailContent({ uuid: latest.uuid });
    const body = content.body ?? "";
    const match = body.match(/https?:\/\/[^\s"'<]+\/invite\/[A-Za-z0-9_-]+/);
    if (!match) {
      throw new Error("Could not extract an /invite/<token> URL from the real message content.");
    }
    const acceptUrl = match[0];
    console.log(`  Extracted accept URL from real message content: ${acceptUrl}`);

    console.log(`\n== Step 4: authenticate as the new dynamic identity ${INVITEE_EMAIL} ==`);
    const inviteeState = await authenticate(INVITEE_EMAIL, testAgentSecret);
    const inviteeContext = await browser.newContext({ storageState: inviteeState });
    const inviteePage = await inviteeContext.newPage();

    console.log("\n== Step 5: accept the invitation via the real UI ==");
    await inviteePage.goto(acceptUrl);
    await inviteePage.getByRole("button", { name: "Accept Invitation" }).click();
    await inviteePage.waitForURL(new RegExp(`/o/${ORG_SLUG}`), { timeout: 10000 });
    console.log("  Accepted; redirected to org page.");

    console.log("\n== Step 6: verify resulting authorization ==");
    await inviteePage.goto(`${BASE_URL}/o/${ORG_SLUG}/assistant`);
    await inviteePage.waitForURL(new RegExp(`/o/${ORG_SLUG}/assistant`), { timeout: 10000 });
    console.log(`  ${INVITEE_EMAIL} can now reach /o/${ORG_SLUG}/assistant — membership confirmed.`);
    await inviteeContext.close();

    console.log("\nVERIFIED: invitation email flow works end-to-end against the live Test environment.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
