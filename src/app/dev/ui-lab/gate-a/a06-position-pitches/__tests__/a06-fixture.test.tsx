import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CANONICAL_TACTICAL_POSITIONS, type CanonicalTacticalPosition } from "@/domain/positions/roles";
import { exactTacticalEvidence, profileEvidence, CONSOLIDATED_PLACEHOLDER_PROFILE_POSITIONS } from "../fixtures";
import { FlatProfilePositionMap } from "../flat-profile-position-map";
import { CandidateTacticalPositionMap } from "../candidate-tactical-position-map";
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

  describe("owner visual feedback (2026-10-09): LW/RW on the attacking-midfield line", () => {
    it("renders LW, RW, LAM, CAM and RAM as five distinct, individually selectable dots on the same line", () => {
      const onSelect = vi.fn();
      render(<CandidateTacticalPositionMap positions={exactTacticalEvidence} onSelectPosition={onSelect} />);

      const lw = screen.getByRole("button", { name: /^Left Wing,/ });
      const rw = screen.getByRole("button", { name: /^Right Wing,/ });
      const lam = screen.getByRole("button", { name: /^Left Attacking Mid,/ });
      const cam = screen.getByRole("button", { name: /^Central Attacking Mid,/ });
      const ram = screen.getByRole("button", { name: /^Right Attacking Mid,/ });

      expect(new Set([lw, rw, lam, cam, ram]).size).toBe(5);
      // Same line (same yPct) — LW/RW now sit alongside LAM/CAM/RAM, not CF's line.
      expect(lw.style.top).toBe(lam.style.top);
      expect(rw.style.top).toBe(lam.style.top);
      // But distinct lanes (different xPct) — not stacked on each other.
      expect(new Set([lw, lam, cam, ram, rw].map((el) => el.style.left)).size).toBe(5);
    });

    it("selecting LW calls onSelectPosition with its real canonical code", () => {
      const onSelect = vi.fn();
      render(<CandidateTacticalPositionMap positions={exactTacticalEvidence} onSelectPosition={onSelect} />);
      fireEvent.click(screen.getByRole("button", { name: /^Left Wing,/ }));
      expect(onSelect).toHaveBeenCalledWith("LW");
    });

    it("keeps CF central with LCF/RCF distinct beside it on the attack line, separate from LW/RW's line", () => {
      render(<CandidateTacticalPositionMap positions={exactTacticalEvidence} onSelectPosition={() => {}} />);
      const cf = screen.getByRole("button", { name: /^Centre-Forward,/ });
      const lcf = screen.getByRole("button", { name: /^Left Centre-Forward,/ });
      const rcf = screen.getByRole("button", { name: /^Right Centre-Forward,/ });
      const lw = screen.getByRole("button", { name: /^Left Wing,/ });

      expect(cf.style.top).toBe(lcf.style.top);
      expect(cf.style.top).toBe(rcf.style.top);
      expect(cf.style.top).not.toBe(lw.style.top); // different line from LW/RW now
      expect(new Set([lcf, cf, rcf].map((el) => el.style.left)).size).toBe(3); // distinct, not stacked
    });

    it("renders an on-page disclosure that this is a proposed presentation, not the unmodified production placement", () => {
      render(
        <ThemeProvider>
          <A06PositionPitchesPage />
        </ThemeProvider>,
      );
      const disclosure = screen.getByTestId("a06-presentation-disclosure");
      expect(disclosure.textContent).toMatch(/not the unmodified production coordinate placement/i);
    });
  });
});
