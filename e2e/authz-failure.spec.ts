import { test, expect } from "@playwright/test";

// Expected-authorization-failure coverage (ADR-0078, follow-up to ADR-0069). Runs under the
// "chromium-viewer" Playwright project (playwright.config.ts), authenticated as viewer-a — a
// real VIEWER-role persona in Org A only, from the canonical seed dataset
// (scripts/seed-test-dataset.ts). Both specs assert genuine server-side denial (no data leaked,
// no mutation persisted), not just that a UI element is hidden.

test.describe("VIEWER role cannot perform a mutation", () => {
  test("creating a team is denied and nothing is persisted", async ({ page }) => {
    // src/app/(app)/o/[orgSlug]/teams/new/page.tsx has no role gate of its own — the VIEWER
    // role sees the full create-team form. The denial happens inside createTeamAction's
    // requireMutationRole(ctx) check (src/app/(app)/teams/actions.ts), which — like every other
    // requireMutationRole call site in the app (51 of them) — sits before the action's own
    // try/catch, so it is not caught into a friendly inline redirect. It surfaces as the app's
    // generic error boundary (src/app/(app)/error.tsx). This is the app's real, consistent
    // behavior for every authorization failure, not a bug specific to team creation.
    const uniqueName = `E2E VIEWER Denied ${Date.now()}`;

    await page.goto("/o/test-club-a/teams/new");
    await page.locator("#name").fill(uniqueName);
    await page.getByRole("button", { name: "Create team" }).click();

    await expect(page.getByText("Something went wrong")).toBeVisible();

    // Confirm the mutation genuinely did not persist — not just that an error screen appeared.
    await page.goto("/o/test-club-a/teams");
    await expect(page.getByText(uniqueName)).toHaveCount(0);
  });
});

test.describe("cross-organisation access is denied", () => {
  test("viewer-a (Org A only) cannot load Org B's workspace", async ({ page }) => {
    // viewer-a has no membership in Org B ("Other Test Club", slug test-club-b). resolveOrganisationAccess
    // throws OrganisationMembershipError (extends AuthorizationError) inside the page component,
    // which is likewise uncaught and surfaces via the same generic error boundary — never a page
    // that renders any of Org B's data.
    await page.goto("/o/test-club-b/assistant");

    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(page.getByText("B1 Lions")).toHaveCount(0);
    await expect(page.getByText("B1 Wolves")).toHaveCount(0);
  });
});
