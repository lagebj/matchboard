import { describe, it, expect } from "vitest";
import { resolveApproval, scenarioResultsRelevantToThisPr } from "../resolve-approval.mjs";

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

describe("scenarioResultsRelevantToThisPr — issue #833 (full-registry re-check must not inherit unrelated approval debt)", () => {
  it("excludes a scenario this PR's diff never touches and whose own comment thread never discussed it", () => {
    const scenarios = [
      scenario(),
      scenario({ scenarioId: "LEGACY-UNRELATED", componentOwners: ["src/components/touchline/some-old-shared.tsx"] }),
    ];
    const changedFiles = ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"];
    const { scenarios: results } = resolveApproval(
      base({ scenarios, changedFiles, comments: [comment(`/visual-approve ${HEAD}`)] }),
    );
    // Full registry-wide resolution still awaits the unrelated scenario (today's existing,
    // unchanged behavior) — the fix is which of these this PR's own conclusion depends on.
    expect(results.get("LEGACY-UNRELATED")?.state).toBe("AWAITING_APPROVAL");

    const relevant = scenarioResultsRelevantToThisPr(results, scenarios, changedFiles);
    expect(relevant.has("B01")).toBe(true);
    expect(relevant.has("LEGACY-UNRELATED")).toBe(false);
  });

  it("keeps a scenario this PR's diff touches, even if it is not approved", () => {
    const scenarios = [scenario()];
    const changedFiles = ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"];
    const { scenarios: results } = resolveApproval(base({ scenarios, changedFiles, comments: [] }));
    expect(results.get("B01")?.state).toBe("AWAITING_APPROVAL");

    const relevant = scenarioResultsRelevantToThisPr(results, scenarios, changedFiles);
    expect(relevant.get("B01")?.state).toBe("AWAITING_APPROVAL");
  });

  it("keeps a scenario this PR's own comment thread explicitly decided about, even though its componentOwners do not intersect the diff", () => {
    const scenarios = [
      scenario(),
      scenario({ scenarioId: "LEGACY-EXPLICIT", componentOwners: ["src/components/touchline/some-old-shared.tsx"] }),
    ];
    const changedFiles = ["src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx"];
    const { scenarios: results } = resolveApproval(
      base({ scenarios, changedFiles, comments: [comment(`/visual-approve ${HEAD}\nscenarios: LEGACY-EXPLICIT`)] }),
    );
    expect(results.get("LEGACY-EXPLICIT")?.state).toBe("APPROVED");
    expect(results.get("LEGACY-EXPLICIT")?.source).toBe("PR_COMMENT");

    const relevant = scenarioResultsRelevantToThisPr(results, scenarios, changedFiles);
    expect(relevant.has("LEGACY-EXPLICIT")).toBe(true);
  });

  it("falls back to every scenario when nothing's componentOwners intersect the changed files at all (infra-only change)", () => {
    const scenarios = [scenario(), scenario({ scenarioId: "B02", componentOwners: ["src/app/dev/ui-lab/gate-b/b02-other/page.tsx"] })];
    const changedFiles = ["scripts/ui-lab-visual-review.mjs"];
    const { scenarios: results } = resolveApproval(base({ scenarios, changedFiles, comments: [] }));

    const relevant = scenarioResultsRelevantToThisPr(results, scenarios, changedFiles);
    expect(relevant.has("B01")).toBe(true);
    expect(relevant.has("B02")).toBe(true);
  });

  it("reproduces PR #844's exact real-world shape: 13 own scenarios approved, 31 unrelated legacy scenarios excluded", () => {
    const ownScenarios = Array.from({ length: 13 }, (_, i) =>
      scenario({ scenarioId: `GATE-D-OWN-${i}`, componentOwners: [`src/app/dev/ui-lab/gate-d/own-${i}.tsx`] }),
    );
    const legacyScenarios = Array.from({ length: 31 }, (_, i) =>
      scenario({ scenarioId: `LEGACY-${i}`, componentOwners: [`src/components/touchline/legacy-${i}.tsx`] }),
    );
    const scenarios = [...ownScenarios, ...legacyScenarios];
    const changedFiles = ownScenarios.map((s) => s.componentOwners[0]);
    const { scenarios: results } = resolveApproval(base({ scenarios, changedFiles, comments: [comment(`/visual-approve ${HEAD}`)] }));

    for (const s of ownScenarios) expect(results.get(s.scenarioId)?.state).toBe("APPROVED");
    for (const s of legacyScenarios) expect(results.get(s.scenarioId)?.state).toBe("AWAITING_APPROVAL");

    const relevant = scenarioResultsRelevantToThisPr(results, scenarios, changedFiles);
    expect(relevant.size).toBe(13);
    for (const s of ownScenarios) expect(relevant.get(s.scenarioId)?.state).toBe("APPROVED");
    for (const s of legacyScenarios) expect(relevant.has(s.scenarioId)).toBe(false);
  });
});
