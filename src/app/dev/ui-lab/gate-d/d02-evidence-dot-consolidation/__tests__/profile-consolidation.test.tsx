import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { consolidateExactSharesByProfile, type ExactPositionShare } from "../shared/position-profile-consolidation";
import { ConsolidatedPositionEvidence } from "../shared/consolidated-position-evidence";
import { stories as populatedStories } from "../populated-evidence/fixtures";
import { stories as sparseStories } from "../sparse-evidence/fixtures";

const populatedPositionStory = populatedStories.find((s) => s.group === "POSITION")!;
const sparsePositionStory = sparseStories.find((s) => s.group === "POSITION")!;
// Fixture type carries `code: string` (the real PlayerEvidenceStoryData shape); every fixture
// value is a real CanonicalTacticalPosition literal, narrowed here the same way evidence-groups.tsx does.
const populatedExactShares = populatedPositionStory.positionShares as ExactPositionShare[];
const sparseExactShares = sparsePositionStory.positionShares as ExactPositionShare[];

describe("D02 — 24-to-14 profile consolidation (owner remediation 2026-11-24)", () => {
  it("1. maps every exact code in the populated fixture to its correct profile role", () => {
    const result = consolidateExactSharesByProfile(populatedExactShares);
    const byCode = new Map(result.map((p) => [p.code, p.sharePercent]));
    expect(byCode.get("CB")).toBe(58 + 25); // CB + RCB
    expect(byCode.get("DM")).toBe(17); // CDM
    expect(byCode.size).toBe(2);
  });

  it("2. profile-level shares sum to 100%", () => {
    const result = consolidateExactSharesByProfile(populatedExactShares);
    expect(result.reduce((sum, p) => sum + p.sharePercent, 0)).toBe(100);
  });

  it("3. exact-level shares sum to 100% (unchanged by consolidation)", () => {
    const total = populatedExactShares.reduce((sum, s) => sum + s.sharePercent, 0);
    expect(total).toBe(100);
  });

  it("4. no exact code contributes to more than one profile bucket (no duplicated contribution)", () => {
    const result = consolidateExactSharesByProfile(populatedExactShares);
    // Every exact share's sharePercent appears in exactly one profile total — reconstructing the
    // grand total from profile-level sums must equal the grand total from exact-level sums.
    const exactTotal = populatedExactShares.reduce((sum, s) => sum + s.sharePercent, 0);
    const profileTotal = result.reduce((sum, p) => sum + p.sharePercent, 0);
    expect(profileTotal).toBe(exactTotal);
  });

  it("5. the sparse (single-code) fixture still consolidates and renders correctly at both levels", () => {
    const result = consolidateExactSharesByProfile(sparseExactShares);
    expect(result).toEqual([{ code: "LM", sharePercent: 100 }]);

    render(
      <ThemeProvider>
        <ConsolidatedPositionEvidence question={sparsePositionStory.question} exactShares={sparseExactShares} />
      </ThemeProvider>,
    );
    // With only one exact code, the profile-level view and the exact drill-down both read
    // "LM 100%" — identical text in two places is correct here (profile LM = exact LM, trivially).
    expect(screen.getAllByText("LM 100%")).toHaveLength(2);
  });

  it("6. a profile with no contributing exact code is absent, never fabricated as an observed zero", () => {
    const result = consolidateExactSharesByProfile([
      { code: "CB", sharePercent: 60 },
      { code: "RCB", sharePercent: 0 }, // a genuinely-recorded zero contribution
      { code: "RB", sharePercent: 40 },
    ]);
    const byCode = new Map(result.map((p) => [p.code, p.sharePercent]));
    // RCB's recorded zero still contributes to (and does not distort) CB's real total.
    expect(byCode.get("CB")).toBe(60);
    expect(byCode.get("RB")).toBe(40);
    // DM was never observed at all — it must not appear as a fabricated `{ code: "DM", sharePercent: 0 }`.
    expect(byCode.has("DM")).toBe(false);
  });

  it("7. the exact tactical breakdown remains accessible alongside the profile-level view", () => {
    render(
      <ThemeProvider>
        <ConsolidatedPositionEvidence question={populatedPositionStory.question} exactShares={populatedExactShares} />
      </ThemeProvider>,
    );
    const details = screen.getByText("Exact tactical breakdown").closest("details");
    expect(details).not.toBeNull();
    // <details> content is present in the DOM (queryable) regardless of open/collapsed state —
    // the exact breakdown is never removed, only tucked behind a drill-down disclosure.
    expect(within(details!).getByText("CB 58%")).toBeInTheDocument();
    expect(within(details!).getByText("RCB 25%")).toBeInTheDocument();
    expect(within(details!).getByText("CDM 17%")).toBeInTheDocument();
  });
});
