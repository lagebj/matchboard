import { describe, it, expect } from "vitest";
import { resolveApproval } from "../resolve-approval.mjs";

const HEAD = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const OLD = "0000000000000000000000000000000000000000";
const alwaysYes = () => true;
const alwaysNo = () => false;

function scenario(overrides: Record<string, unknown> = {}) {
  return {
    scenarioId: "B01",
    componentOwners: ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"],
    legacyApproval: null,
    ...overrides,
  };
}

function base(overrides: Partial<Parameters<typeof resolveApproval>[0]> = {}) {
  return {
    scenarios: [scenario()],
    changedFiles: ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"],
    comments: [],
    isPrivileged: alwaysYes,
    isVisualAuthority: alwaysYes,
    currentFingerprintForScenario: () => "fp-current",
    fingerprintAtShaForScenario: () => null,
    currentSha: HEAD,
    ...overrides,
  };
}

function comment(body: string, user = "lagebj", createdAt = "2026-01-01T00:00:00Z") {
  return { body, user, createdAt, id: Math.random() };
}

describe("resolveApproval — unscoped commands", () => {
  it("approves the exact current head for the scenario whose componentOwners match the changed files", () => {
    const result = resolveApproval(base({ comments: [comment(`/visual-approve ${HEAD}`)] }));
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
    expect(result.scenarios.get("B01")?.source).toBe("PR_COMMENT");
  });

  it("leaves a scenario AWAITING_APPROVAL when its componentOwners do not intersect the changed files and no fallback applies", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario(), scenario({ scenarioId: "B02", componentOwners: ["src/app/dev/ui-lab/gate-b/b02-other/page.tsx"] })],
        changedFiles: ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"],
        comments: [comment(`/visual-approve ${HEAD}`)],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
    expect(result.scenarios.get("B02")?.state).toBe("AWAITING_APPROVAL");
  });

  it("falls back to scoping every scenario when no componentOwners intersect the changed files at all", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario(), scenario({ scenarioId: "B02", componentOwners: ["src/app/dev/ui-lab/gate-b/b02-other/page.tsx"] })],
        changedFiles: ["scripts/ui-lab-visual-review.mjs"],
        comments: [comment(`/visual-approve ${HEAD}`)],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
    expect(result.scenarios.get("B02")?.state).toBe("APPROVED");
  });
});

describe("resolveApproval — explicit scenario scoping", () => {
  it("approves only the explicitly named scenarios, leaving others untouched", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario(), scenario({ scenarioId: "B04", componentOwners: ["src/app/dev/ui-lab/gate-b/b04/page.tsx"] })],
        changedFiles: ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx", "src/app/dev/ui-lab/gate-b/b04/page.tsx"],
        comments: [comment(`/visual-approve ${HEAD}\nscenarios: B01`)],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
    expect(result.scenarios.get("B04")?.state).toBe("AWAITING_APPROVAL");
  });

  it("reports a top-level error for an unknown scenario ID rather than silently ignoring it", () => {
    const result = resolveApproval(base({ comments: [comment(`/visual-approve ${HEAD}\nscenarios: B99`)] }));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/B99/);
  });

  it("a rejection scoped to one scenario does not revoke another scenario's independent approval", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario(), scenario({ scenarioId: "B04", componentOwners: ["src/app/dev/ui-lab/gate-b/b04/page.tsx"] })],
        changedFiles: ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx", "src/app/dev/ui-lab/gate-b/b04/page.tsx"],
        comments: [
          comment(`/visual-approve ${HEAD}\nscenarios: B01, B04`, "lagebj", "2026-01-01T00:00:00Z"),
          comment(`/visual-reject ${HEAD}\nscenarios: B04`, "lagebj", "2026-01-02T00:00:00Z"),
        ],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
    expect(result.scenarios.get("B04")?.state).toBe("REJECTED");
  });

  it("a later approval of a rejected scenario does not reapprove an unrelated rejected scenario", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario(), scenario({ scenarioId: "B04", componentOwners: ["src/app/dev/ui-lab/gate-b/b04/page.tsx"] })],
        changedFiles: ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx", "src/app/dev/ui-lab/gate-b/b04/page.tsx"],
        comments: [
          comment(`/visual-reject ${HEAD}\nscenarios: B01, B04`, "lagebj", "2026-01-01T00:00:00Z"),
          comment(`/visual-approve ${HEAD}\nscenarios: B04`, "lagebj", "2026-01-02T00:00:00Z"),
        ],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("REJECTED");
    expect(result.scenarios.get("B04")?.state).toBe("APPROVED");
  });
});

describe("resolveApproval — authorization", () => {
  it("ignores a comment from an actor with write access but not on the visual-authority allowlist", () => {
    const result = resolveApproval(
      base({
        isPrivileged: alwaysYes,
        isVisualAuthority: alwaysNo,
        comments: [comment(`/visual-approve ${HEAD}`)],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("AWAITING_APPROVAL");
  });

  it("ignores a comment from an actor on the allowlist but without current write access", () => {
    const result = resolveApproval(
      base({
        isPrivileged: alwaysNo,
        isVisualAuthority: alwaysYes,
        comments: [comment(`/visual-approve ${HEAD}`)],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("AWAITING_APPROVAL");
  });
});

describe("resolveApproval — staleness", () => {
  it("reports STALE when the approved SHA's fingerprint for this scenario no longer matches the current one", () => {
    const result = resolveApproval(
      base({
        comments: [comment(`/visual-approve ${OLD}`)],
        currentFingerprintForScenario: () => "fp-current",
        fingerprintAtShaForScenario: (_scenarioId: string, sha: string) => (sha === OLD ? "fp-old-different" : null),
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("STALE");
  });

  it("reports APPROVED when an older approved SHA's fingerprint for this scenario matches the current one", () => {
    const result = resolveApproval(
      base({
        comments: [comment(`/visual-approve ${OLD}`)],
        currentFingerprintForScenario: () => "fp-same",
        fingerprintAtShaForScenario: (_scenarioId: string, sha: string) => (sha === OLD ? "fp-same" : null),
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
  });
});

describe("resolveApproval — legacy manifest fallback", () => {
  it("honors a committed manifest approval when no PR comment addresses the scenario at all", () => {
    const result = resolveApproval(
      base({
        scenarios: [
          scenario({
            legacyApproval: { revisionSha: OLD, approvedBy: "Lage Berger-Brendryen", approvedAt: "2026-10-20" },
          }),
        ],
        changedFiles: [],
        comments: [],
        currentFingerprintForScenario: () => "fp-same",
        fingerprintAtShaForScenario: (_scenarioId: string, sha: string) => (sha === OLD ? "fp-same" : null),
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("APPROVED");
    expect(result.scenarios.get("B01")?.source).toBe("LEGACY_MANIFEST");
  });

  it("reports STALE for a committed manifest approval whose fingerprint no longer matches (superseded revision)", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario({ legacyApproval: { revisionSha: OLD, approvedBy: "Lage Berger-Brendryen", approvedAt: "2026-10-20" } })],
        changedFiles: [],
        comments: [],
        currentFingerprintForScenario: () => "fp-new",
        fingerprintAtShaForScenario: (_scenarioId: string, sha: string) => (sha === OLD ? "fp-old" : null),
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("STALE");
  });

  it("does not promote a legacy approval when real PR comments exist for the scenario, even if they reject it", () => {
    const result = resolveApproval(
      base({
        scenarios: [scenario({ legacyApproval: { revisionSha: OLD, approvedBy: "Lage Berger-Brendryen", approvedAt: "2026-10-20" } })],
        comments: [comment(`/visual-reject ${HEAD}`)],
      }),
    );
    expect(result.scenarios.get("B01")?.state).toBe("REJECTED");
    expect(result.scenarios.get("B01")?.source).toBe("PR_COMMENT");
  });

  it("reports AWAITING_APPROVAL, not a fabricated approval, when no comment and no legacy approval exist", () => {
    const result = resolveApproval(base({ comments: [] }));
    expect(result.scenarios.get("B01")?.state).toBe("AWAITING_APPROVAL");
    expect(result.scenarios.get("B01")?.source).toBeNull();
  });
});
