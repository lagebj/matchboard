import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PositionEvidenceDot } from "../position-evidence-dot";

/**
 * Regression coverage for human review feedback (2026-09-13): dots must stay fully circular
 * (fixed pixel diameter, not a percentage of a non-square container) and must never render the
 * position code as visible text inside the mark.
 */
describe("PositionEvidenceDot", () => {
  it("uses an equal, fixed pixel width and height (a true circle regardless of container aspect ratio)", () => {
    render(
      <PositionEvidenceDot
        positionCode="LW"
        positionLabel="Left Wing"
        rank={1}
        supportBand="STRONGEST"
        confidence="HIGH"
        xPct={20}
        yPct={30}
      />,
    );
    const dot = screen.getByLabelText(/Left Wing/);
    expect(dot.style.width).not.toMatch(/%/);
    expect(dot.style.height).not.toMatch(/%/);
    expect(dot.style.width).toBe(dot.style.height);
  });

  it("never renders the position code as visible text inside the dot", () => {
    render(
      <PositionEvidenceDot
        positionCode="LW"
        positionLabel="Left Wing"
        rank={1}
        supportBand="STRONGEST"
        confidence="HIGH"
        xPct={20}
        yPct={30}
      />,
    );
    const dot = screen.getByLabelText(/Left Wing/);
    // The accessible name (sr-only) legitimately contains text; there must be no *visible* text node.
    expect(dot.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(dot.textContent?.trim()).not.toBe("LW");
  });

  it("exposes the position code only as a data attribute, not as rendered content", () => {
    render(
      <PositionEvidenceDot
        positionCode="CB"
        positionLabel="Centre Back"
        rank={null}
        supportBand="LIMITED"
        confidence="LOW"
        xPct={50}
        yPct={80}
      />,
    );
    const dot = screen.getByLabelText(/Centre Back/);
    expect(dot.getAttribute("data-position-code")).toBe("CB");
  });

  it("scales diameter with perspectiveScale while staying circular", () => {
    render(
      <PositionEvidenceDot
        positionCode="ST"
        positionLabel="Striker"
        rank={2}
        supportBand="STRONG"
        confidence="MEDIUM"
        xPct={50}
        yPct={10}
        perspectiveScale={0.9}
      />,
    );
    const dot = screen.getByLabelText(/Striker/);
    expect(dot.style.width).toBe(dot.style.height);
    expect(parseFloat(dot.style.width)).toBeLessThan(17); // STRONG base diameter (17px) * 0.9
  });
});
