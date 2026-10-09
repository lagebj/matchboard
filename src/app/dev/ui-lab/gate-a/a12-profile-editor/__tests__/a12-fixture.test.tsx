import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { exactAppearances, profileEvidenceAggregates } from "../fixtures";
import { LegacyEvidenceDrilldown } from "../legacy-evidence-drilldown";
import { ProfilePositionSelector } from "../profile-position-selector";
import { PROFILE_POSITIONS } from "../../shared/profile-position-model";

/**
 * A12 candidate fixture invariants (`20_UI_LAB_CANDIDATE_WAVES.md` A12): the selector's visible
 * labels match the 14-role profile vocabulary exactly, and the evidence drilldown never hides a
 * sided tactical interval behind its collapsed profile label.
 */
describe("A12 profile-editor candidate fixture", () => {
  it("renders exactly the 14 profile labels in the selector, never a 24-code sided label", () => {
    render(<ProfilePositionSelector value={null} onChange={() => {}} />);
    for (const position of PROFILE_POSITIONS) {
      expect(screen.getByRole("radio", { name: position })).toBeInTheDocument();
    }
    expect(screen.queryByRole("radio", { name: "LCM" })).not.toBeInTheDocument();
  });

  it("the CM profile aggregate preserves both sided source intervals from the fixture", () => {
    const cm = profileEvidenceAggregates.find((a) => a.profile === "CM");
    expect(cm?.totalMinutes).toBe(30);
    expect(cm?.appearanceCount).toBe(2);

    render(<LegacyEvidenceDrilldown aggregate={cm!} />);
    expect(screen.getByText(/LCM — 20 min/)).toBeInTheDocument();
    expect(screen.getByText(/RCM — 10 min/)).toBeInTheDocument();
  });

  it("the fixture's RB appearance is never folded into the CM aggregate", () => {
    expect(exactAppearances.some((a) => a.tacticalPosition === "RB")).toBe(true);
    const rb = profileEvidenceAggregates.find((a) => a.profile === "RB");
    expect(rb?.totalMinutes).toBe(45);
    const cm = profileEvidenceAggregates.find((a) => a.profile === "CM");
    expect(cm?.breakdown.some((b) => b.tacticalPosition === "RB")).toBe(false);
  });
});
