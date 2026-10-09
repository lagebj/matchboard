import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CANONICAL_TACTICAL_POSITIONS } from "@/domain/positions/roles";
import { exactTacticalEvidence, profileEvidence } from "../fixtures";
import { FlatProfilePositionMap } from "../flat-profile-position-map";
import { PROFILE_POSITIONS } from "../../shared/profile-position-model";

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

  it("every consolidated profile dot (CB/DM/CM/AM/F) never exceeds the strongest support of its exact source group", () => {
    const BAND_RANK = { LIMITED: 0, ESTABLISHED: 1, STRONG: 2, STRONGEST: 3 } as const;
    const GROUPS: Record<string, string[]> = {
      CB: ["LCB", "CB", "RCB"],
      DM: ["LDM", "CDM", "RDM"],
      CM: ["LCM", "CM", "RCM"],
      AM: ["LAM", "CAM", "RAM"],
      F: ["LCF", "CF", "RCF"],
    };
    for (const [profile, exactCodes] of Object.entries(GROUPS)) {
      const profileEntry = profileEvidence.find((e) => e.position === profile)!;
      const maxExactBand = Math.max(
        ...exactCodes.map((code) => BAND_RANK[exactTacticalEvidence.find((e) => e.positionCode === code)!.supportBand]),
      );
      expect(BAND_RANK[profileEntry.supportBand]).toBe(maxExactBand);
    }
  });
});
