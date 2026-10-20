import { describe, it, expect } from "vitest";
import { classify, classifyLightweightDeployEligibility } from "../classify.mjs";

describe("classify", () => {
  it("an ordinary unrelated PR is not applicable", () => {
    const result = classify(["src/lib/matches/completed-match-story.ts", "src/app/api/health/route.ts"]);
    expect(result.applicable).toBe(false);
  });

  it("a new UI Lab candidate PR is applicable", () => {
    const result = classify(["src/app/dev/ui-lab/gate-b/b05-post-match-report/page.tsx"]);
    expect(result.applicable).toBe(true);
    expect(result.scenarios).toContain("gate-b/b05-post-match-report");
  });

  it("a shared Touchline component change is applicable", () => {
    const result = classify(["src/components/touchline/pitch/touchline-planning-pitch.tsx"]);
    expect(result.applicable).toBe(true);
  });

  it("a shared match-detail component change is applicable", () => {
    const result = classify(["src/components/matches/match-detail/match-flow-panel.tsx"]);
    expect(result.applicable).toBe(true);
  });

  it("a doc-only PR under docs/ui-lab is not applicable on its own", () => {
    const result = classify(["docs/ui-lab/gate-b-w1-candidates/BLOCKERS.md"]);
    expect(result.applicable).toBe(false);
  });

  it("a candidate_manifest.json change is applicable even though it's under docs/ui-lab", () => {
    const result = classify(["docs/ui-lab/gate-b-w1-candidates/candidate_manifest.json"]);
    expect(result.applicable).toBe(true);
  });

  it("a capture-attestation.json change is applicable", () => {
    const result = classify(["docs/ui-lab/gate-b-w1-candidates/capture-attestation.json"]);
    expect(result.applicable).toBe(true);
  });

  it("the ui-lab-visual-review.mjs script itself is applicable", () => {
    const result = classify(["scripts/ui-lab-visual-review.mjs"]);
    expect(result.applicable).toBe(true);
  });

  it("fails closed when the changed-file inventory is marked incomplete, regardless of the paths given", () => {
    const result = classify(["README.md"], { incomplete: true });
    expect(result.applicable).toBe(true);
    expect(result.reason).toMatch(/incomplete/i);
  });

  it("mixed PR (one relevant file among many unrelated ones) is applicable", () => {
    const result = classify(["src/lib/foo.ts", "src/app/dev/ui-lab/gate-b/b01-planned-ready/fixtures.ts", "README.md"]);
    expect(result.applicable).toBe(true);
  });
});

describe("classifyLightweightDeployEligibility", () => {
  it("a UI-Lab-only change is eligible", () => {
    const result = classifyLightweightDeployEligibility(["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"]);
    expect(result.eligible).toBe(true);
  });

  it("a Prisma schema change is ineligible", () => {
    const result = classifyLightweightDeployEligibility(["prisma/schema.prisma"]);
    expect(result.eligible).toBe(false);
  });

  it("a migration change is ineligible", () => {
    const result = classifyLightweightDeployEligibility(["prisma/migrations/20261020_add_x/migration.sql"]);
    expect(result.eligible).toBe(false);
  });

  it("an auth-code change is ineligible", () => {
    const result = classifyLightweightDeployEligibility(["src/lib/auth/session.ts"]);
    expect(result.eligible).toBe(false);
  });

  it("a middleware/proxy change is ineligible", () => {
    const result = classifyLightweightDeployEligibility(["src/proxy.ts"]);
    expect(result.eligible).toBe(false);
  });

  it("a workflow-file change is ineligible (CI/CD itself can't self-certify as lightweight)", () => {
    const result = classifyLightweightDeployEligibility([".github/workflows/visual-review-deploy.yml"]);
    expect(result.eligible).toBe(false);
  });

  it("an env/secret-looking path is ineligible", () => {
    const result = classifyLightweightDeployEligibility([".env.production"]);
    expect(result.eligible).toBe(false);
  });
});
