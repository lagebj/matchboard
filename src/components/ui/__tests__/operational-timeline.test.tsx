import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationalTimeline, TimelineItem } from "../operational-timeline";

describe("OperationalTimeline", () => {
  it("renders items in chronological DOM order with their time labels", () => {
    render(
      <OperationalTimeline aria-label="Test timeline">
        <TimelineItem timeLabel="17:30" state="current" kicker="NOW">
          <p>Live match</p>
        </TimelineItem>
        <TimelineItem timeLabel="19:00" state="next" kicker="NEXT">
          <p>Next match</p>
        </TimelineItem>
        <TimelineItem timeLabel={null} state="attention" kicker="FOLLOW-UP" isLast>
          <p>Post-match report</p>
        </TimelineItem>
      </OperationalTimeline>,
    );

    const list = screen.getByRole("list", { name: "Test timeline" });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Live match");
    expect(items[1].textContent).toContain("Next match");
    expect(items[2].textContent).toContain("Post-match report");
  });

  it("does not print a fake clock time for untimed work", () => {
    render(
      <OperationalTimeline>
        <TimelineItem timeLabel={null} state="attention" kicker="FOLLOW-UP" isLast>
          <p>Untimed follow-up</p>
        </TimelineItem>
      </OperationalTimeline>,
    );
    expect(screen.queryByText("--:--")).toBeNull();
    expect(screen.getByText("Untimed follow-up")).toBeTruthy();
  });
});
