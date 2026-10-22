import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalDiscrepancyDisclosure } from "../goal-discrepancy-disclosure";

describe("GoalDiscrepancyDisclosure (R8-1)", () => {
  it("renders nothing when there is no gap", () => {
    const { container } = render(<GoalDiscrepancyDisclosure gap={{ liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false }} isLocked={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when gap is null", () => {
    const { container } = render(<GoalDiscrepancyDisclosure gap={null} isLocked={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a locked report with no discrepancy (R8-1 required case)", () => {
    const { container } = render(<GoalDiscrepancyDisclosure gap={{ liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false }} isLocked />);
    expect(container).toBeEmptyDOMElement();
  });

  it("editable state: describes a missing goal RECORD, invites adding it, never instructs reopening", () => {
    render(<GoalDiscrepancyDisclosure gap={{ liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true }} isLocked={false} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/3.*goal.*recorded during Live Reporting/i);
    expect(alert.textContent).toMatch(/only 2 goal records?/i);
    expect(alert.textContent).toMatch(/add the missing goal to reconcile the report/i);
    expect(alert.textContent).not.toMatch(/reopen/i);
    expect(alert.textContent).not.toMatch(/scorer attribution/i);
  });

  it("locked state: instructs reopening, never instructs completing an already-completed report", () => {
    render(<GoalDiscrepancyDisclosure gap={{ liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true }} isLocked />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/this completed report is missing 1 goal recorded during Live Reporting/i);
    expect(alert.textContent).toMatch(/reopen the report to add the missing goal/i);
    expect(alert.textContent).not.toMatch(/before completing this report/i);
    expect(alert.textContent).not.toMatch(/scorer attribution/i);
  });

  it("pluralizes correctly for a two-goal discrepancy", () => {
    render(<GoalDiscrepancyDisclosure gap={{ liveGoalsRecorded: 5, attributedGoals: 3, hasGap: true }} isLocked />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/missing 2 goals recorded/i);
    expect(alert.textContent).toMatch(/add the missing goals/i);
  });

  it("uses dynamic counts, not hardcoded values", () => {
    render(<GoalDiscrepancyDisclosure gap={{ liveGoalsRecorded: 7, attributedGoals: 6, hasGap: true }} isLocked={false} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/7 goal/i);
    expect(alert.textContent).toMatch(/only 6 goal record/i);
    expect(alert.textContent).not.toMatch(/\b3\b/);
    expect(alert.textContent).not.toMatch(/\b2\b/);
  });
});
