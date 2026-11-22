import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PositionFitList, type PositionFitEntry } from "../position-fit-list";

// C06-B (Gate C W2 remediation — PR #829): real completed-match evidence captions shown
// alongside each role chip in the selected-player inspector. Evidence is a purely additive
// caption (`title`/`aria-label`) — it must never change tier grouping/order, which
// `classifyExactSuitability` already computed without evidence by design (ADR-0129 §5).

const entries: PositionFitEntry[] = [
  { tier: "NATURAL", roles: ["CM"] },
  { tier: "PLAUSIBLE", roles: ["CB", "RCB"] },
];

describe("PositionFitList — real completed-match evidence captions (C06-B)", () => {
  it("exposes an evidence caption via title/aria-label when evidenceCaptionByRole supplies one for a role", () => {
    render(
      <PositionFitList
        entries={entries}
        evidenceCaptionByRole={{ CM: "3 matches, 180 min" }}
      />,
    );

    const chip = screen.getByText("CM");
    expect(chip).toHaveAttribute("title", "3 matches, 180 min");
    expect(chip).toHaveAttribute("aria-label", "CM — 3 matches, 180 min");
  });

  it("renders a role chip with no title/aria-label when that role has no evidence caption", () => {
    render(
      <PositionFitList
        entries={entries}
        evidenceCaptionByRole={{ CM: "3 matches, 180 min" }}
      />,
    );

    const chip = screen.getByText("CB");
    expect(chip).not.toHaveAttribute("title");
    expect(chip).not.toHaveAttribute("aria-label");
  });

  it("renders every role chip with no title/aria-label when evidenceCaptionByRole is not supplied (backward compatible with every existing caller, e.g. the UI Lab position-fit candidate)", () => {
    render(<PositionFitList entries={entries} />);

    for (const roleText of ["CM", "CB", "RCB"]) {
      const chip = screen.getByText(roleText);
      expect(chip).not.toHaveAttribute("title");
      expect(chip).not.toHaveAttribute("aria-label");
    }
  });

  it("keeps tier grouping/order unaffected by evidence — Natural still renders before Plausible regardless of which role has evidence", () => {
    render(
      <PositionFitList
        entries={entries}
        evidenceCaptionByRole={{ CB: "10 matches, 900 min" }}
      />,
    );

    const tierLabels = screen.getAllByText(/Preferred position|Can play here/);
    expect(tierLabels).toHaveLength(2);
    expect(tierLabels[0].textContent).toBe("Preferred position, high familiarity");
    expect(tierLabels[1].textContent).toBe("Can play here, lower familiarity");
  });
});
