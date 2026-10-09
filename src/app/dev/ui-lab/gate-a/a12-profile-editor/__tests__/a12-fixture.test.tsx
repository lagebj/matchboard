import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { exactAppearances, profileEvidenceAggregates, initialDeclaredTriple } from "../fixtures";
import { LegacyEvidenceDrilldown } from "../legacy-evidence-drilldown";
import { ProfilePositionSelector } from "../profile-position-selector";
import { ProfilePositionTripleEditor } from "../profile-position-triple-editor";
import type { ProfilePositionTriple } from "../profile-triple-selection";
import { PROFILE_POSITIONS } from "../../shared/profile-position-model";

function ControlledEditor({ initial }: { initial: ProfilePositionTriple }) {
  const [value, setValue] = useState(initial);
  return <ProfilePositionTripleEditor value={value} onChange={setValue} />;
}

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

  it("the triple editor starts collapsed, showing a compact Primary/Secondary/Tertiary summary", () => {
    render(<ControlledEditor initial={initialDeclaredTriple} />);
    expect(screen.getByText(/Primary:/)).toBeInTheDocument();
    expect(screen.getByText("CM")).toBeInTheDocument(); // primary value in the summary
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument(); // no selects until expanded
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("expands to three selects plus the 14-role grid, and collapses again on Done", () => {
    render(<ControlledEditor initial={initialDeclaredTriple} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(3); // primary, secondary, tertiary
    expect(screen.getByRole("radio", { name: "CM" })).toBeInTheDocument(); // the 14-button grid

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("never offers the current primary as a secondary/tertiary option, preventing duplicates in the UI", () => {
    render(<ControlledEditor initial={initialDeclaredTriple} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const [, secondarySelect] = screen.getAllByRole("combobox");
    const optionValues = Array.from(secondarySelect.querySelectorAll("option")).map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).not.toContain("CM"); // current primary
  });
});
