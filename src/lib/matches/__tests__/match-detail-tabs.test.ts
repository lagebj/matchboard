import { describe, it, expect } from "vitest";
import {
  getMatchDetailTabs,
  getMatchDetailDefaultTab,
  resolveMatchDetailTab,
  getPostMatchReportTabs,
  getPostMatchReportDefaultTab,
  resolvePostMatchReportTab,
  derivePostMatchReportSurfaceState,
} from "@/lib/matches/match-detail-tabs";

describe("Match Details tab sets", () => {
  it("returns the exact BEFORE tab order (post-launch correction 2026-09-18: Lineup and Tactics folded into Overview)", () => {
    expect(getMatchDetailTabs("BEFORE").map((t) => t.key)).toEqual([
      "overview",
      "rotations",
      "opponent-context",
      "notes",
    ]);
  });

  it("returns the exact AFTER tab order from the canonical golden", () => {
    expect(getMatchDetailTabs("AFTER").map((t) => t.key)).toEqual([
      "overview",
      "events",
      "stats",
      "tactics",
      "after-match",
      "opponent-context",
      "history",
    ]);
  });

  it("defaults to overview in both surfaces", () => {
    expect(getMatchDetailDefaultTab("BEFORE")).toBe("overview");
    expect(getMatchDetailDefaultTab("AFTER")).toBe("overview");
  });

  it("resolves a valid tab as-is", () => {
    expect(resolveMatchDetailTab("BEFORE", "rotations")).toBe("rotations");
    expect(resolveMatchDetailTab("AFTER", "history")).toBe("history");
    expect(resolveMatchDetailTab("AFTER", "tactics")).toBe("tactics");
  });

  it("falls back to the surface default for an invalid tab", () => {
    expect(resolveMatchDetailTab("BEFORE", "nonsense")).toBe("overview");
    expect(resolveMatchDetailTab("BEFORE", null)).toBe("overview");
    expect(resolveMatchDetailTab("BEFORE", undefined)).toBe("overview");
  });

  it("falls back to the surface default when a tab only exists in the other surface", () => {
    expect(resolveMatchDetailTab("BEFORE", "history")).toBe("overview");
    expect(resolveMatchDetailTab("BEFORE", "events")).toBe("overview");
    expect(resolveMatchDetailTab("BEFORE", "tactics")).toBe("overview");
    expect(resolveMatchDetailTab("AFTER", "notes")).toBe("overview");
    expect(resolveMatchDetailTab("AFTER", "rotations")).toBe("overview");
  });

  it("maps legacy pre-existing tab keys to their nearest new equivalent", () => {
    expect(resolveMatchDetailTab("BEFORE", "squad")).toBe("overview");
    expect(resolveMatchDetailTab("BEFORE", "opponent")).toBe("opponent-context");
    expect(resolveMatchDetailTab("AFTER", "opponent")).toBe("opponent-context");
    // "Lineup" folded into Overview (2026-09-18) — an explicit alias, unlike "tactics" which
    // falls back to Overview naturally for BEFORE (it remains a real, different tab for AFTER).
    expect(resolveMatchDetailTab("BEFORE", "lineup")).toBe("overview");
    expect(resolveMatchDetailTab("AFTER", "lineup")).toBe("overview");
  });

  it("does not carry the removed pre-existing 'after-match' key as a BEFORE tab", () => {
    expect(resolveMatchDetailTab("BEFORE", "after-match")).toBe("overview");
  });
});

describe("Post-Match Report tab sets", () => {
  it("returns the exact draft tab order from the canonical golden", () => {
    expect(getPostMatchReportTabs("DRAFT").map((t) => t.key)).toEqual([
      "summary",
      "timeline",
      "players",
      "reflection",
      "review",
    ]);
  });

  it("returns the exact completed tab order from the canonical golden", () => {
    expect(getPostMatchReportTabs("COMPLETED").map((t) => t.key)).toEqual([
      "summary",
      "timeline",
      "players",
      "reflection",
      "combinations",
    ]);
  });

  it("resolves review only in DRAFT and combinations only in COMPLETED", () => {
    expect(resolvePostMatchReportTab("DRAFT", "review")).toBe("review");
    expect(resolvePostMatchReportTab("DRAFT", "combinations")).toBe("players");
    expect(resolvePostMatchReportTab("COMPLETED", "combinations")).toBe("combinations");
    expect(resolvePostMatchReportTab("COMPLETED", "review")).toBe("summary");
  });

  it("falls back to the surface default for an invalid tab", () => {
    expect(resolvePostMatchReportTab("DRAFT", "nonsense")).toBe("players");
    expect(resolvePostMatchReportTab("COMPLETED", "nonsense")).toBe("summary");
  });

  it("defaults DRAFT to the editable Players workspace, not Summary (ADR-0003: direct workflow, e2e-tested)", () => {
    expect(getPostMatchReportDefaultTab("DRAFT")).toBe("players");
    expect(resolvePostMatchReportTab("DRAFT", null)).toBe("players");
    expect(resolvePostMatchReportTab("DRAFT", undefined)).toBe("players");
  });

  it("defaults COMPLETED to Summary, matching the golden's illustrated active tab", () => {
    expect(getPostMatchReportDefaultTab("COMPLETED")).toBe("summary");
    expect(resolvePostMatchReportTab("COMPLETED", null)).toBe("summary");
  });
});

describe("derivePostMatchReportSurfaceState (ADR-0003: REPORTED is not a routine visible state)", () => {
  it("is DRAFT with no report", () => {
    expect(derivePostMatchReportSurfaceState(undefined)).toBe("DRAFT");
    expect(derivePostMatchReportSurfaceState(null)).toBe("DRAFT");
  });

  it("is DRAFT while the report is DRAFT or REPORTED", () => {
    expect(derivePostMatchReportSurfaceState("DRAFT")).toBe("DRAFT");
    expect(derivePostMatchReportSurfaceState("REPORTED")).toBe("DRAFT");
  });

  it("is COMPLETED only once LOCKED", () => {
    expect(derivePostMatchReportSurfaceState("LOCKED")).toBe("COMPLETED");
  });
});
