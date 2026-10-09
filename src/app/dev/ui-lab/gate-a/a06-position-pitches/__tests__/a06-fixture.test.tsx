import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CANONICAL_TACTICAL_POSITIONS, type CanonicalTacticalPosition } from "@/domain/positions/roles";
import { exactTacticalEvidence, profileEvidence, CONSOLIDATED_PLACEHOLDER_PROFILE_POSITIONS } from "../fixtures";
import { FlatProfilePositionMap } from "../flat-profile-position-map";
import { collapseTacticalToProfile, PROFILE_POSITIONS } from "../../shared/profile-position-model";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A06PositionPitchesPage from "../page";

/**
 * A06 candidate fixture invariants (PR #777 remediation): the fixture now exercises the full
 * 24-code vocabulary (not just 3 non-collapsing codes), and LB/LWB/RB/RWB must render as
 * simultaneously visible, distinguishable, individually selectable dots.
 */
describe("A06 position-pitches candidate fixture", () => {
  it("the exact-tactical fixture covers all 24 canonical tactical positions", () => {
    const codes = exactTacticalEvidence.map((e) => e.positionCode).sort();
    expect(codes).toEqual([...CANONICAL_TACTICAL_POSITIONS].sort());
  });

  it("the profile fixture covers all 14 profile positions", () => {
    const positions = profileEvidence.map((e) => e.position).sort();
    expect(positions).toEqual([...PROFILE_POSITIONS].sort());
  });

  it("LB, LWB, RB and RWB each render as a distinct, individually selectable dot", () => {
    render(<FlatProfilePositionMap entries={profileEvidence} onSelectPosition={() => {}} />);

    const lb = screen.getByRole("button", { name: /^LB,/ });
    const lwb = screen.getByRole("button", { name: /^LWB,/ });
    const rb = screen.getByRole("button", { name: /^RB,/ });
    const rwb = screen.getByRole("button", { name: /^RWB,/ });

    // Four genuinely distinct DOM nodes, each independently clickable.
    expect(new Set([lb, lwb, rb, rwb]).size).toBe(4);
    for (const el of [lb, lwb, rb, rwb]) {
      expect(el).toHaveAttribute("data-position-code");
      expect(el.style.left).not.toBe("");
      expect(el.style.top).not.toBe("");
    }
    // Not stacked on top of one another.
    expect(lb.style.top).not.toBe(lwb.style.top);
    expect(rb.style.top).not.toBe(rwb.style.top);
  });

  describe("PR #777 remediation (finding A06-2): no unapproved aggregation rule", () => {
    it("preserves every consolidated group's three exact-level source entries exactly as the fixture defines them", () => {
      const GROUPS: Record<string, string[]> = {
        CB: ["LCB", "CB", "RCB"],
        DM: ["LDM", "CDM", "RDM"],
        CM: ["LCM", "CM", "RCM"],
        AM: ["LAM", "CAM", "RAM"],
        F: ["LCF", "CF", "RCF"],
      };
      for (const exactCodes of Object.values(GROUPS)) {
        for (const code of exactCodes) {
          const entry = exactTacticalEvidence.find((e) => e.positionCode === code);
          expect(entry, `exact entry for ${code} must still exist, unmodified`).toBeDefined();
        }
      }
      // Exactly 24 exact entries, 24 canonical codes — nothing added or dropped by this fix.
      expect(exactTacticalEvidence).toHaveLength(24);
    });

    it("maps each consolidated profile dot to the position its real exact-level group collapses to (mapping, not support, correctness)", () => {
      for (const profile of CONSOLIDATED_PLACEHOLDER_PROFILE_POSITIONS) {
        const anySourceCode = exactTacticalEvidence
          .map((e) => e.positionCode)
          .find((code) => collapseTacticalToProfile(code as CanonicalTacticalPosition) === profile);
        expect(anySourceCode, `at least one exact code should collapse to ${profile}`).toBeDefined();
        expect(profileEvidence.find((e) => e.position === profile)).toBeDefined();
      }
    });

    it("gives every consolidated profile dot the same flat illustrative placeholder, never a value that looks derived from its group's exact values", () => {
      for (const profile of CONSOLIDATED_PLACEHOLDER_PROFILE_POSITIONS) {
        const entry = profileEvidence.find((e) => e.position === profile)!;
        expect(entry.supportBand).toBe("ESTABLISHED");
        expect(entry.confidence).toBe("MEDIUM");
        expect(entry.rank).toBeNull();
      }
    });

    it("renders an explicit on-page disclosure that consolidated values are illustrative, not computed", () => {
      render(
        <ThemeProvider>
          <A06PositionPitchesPage />
        </ThemeProvider>,
      );
      const disclosure = screen.getByTestId("a06-illustrative-disclosure");
      expect(disclosure.textContent).toMatch(/illustrative/i);
      expect(disclosure.textContent).toMatch(/not a computed aggregate/i);
    });
  });
});
