import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionBanner } from "../decision-banner";

describe("DecisionBanner", () => {
  it("renders blocked variant with alert role", () => {
    render(<DecisionBanner variant="blocked" title="Blocked" />);
    const banner = screen.getByRole("alert");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain("Blocked");
  });

  it("renders decision variant with alert role", () => {
    render(<DecisionBanner variant="decision" title="Decide" />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders note variant with status role", () => {
    render(<DecisionBanner variant="note" title="Note" />);
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("Note");
  });

  it("renders finalized variant with status role", () => {
    render(<DecisionBanner variant="finalized" title="Locked" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders success variant with status role", () => {
    render(<DecisionBanner variant="success" title="Done" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(<DecisionBanner variant="note" title="Title" description="Details" />);
    expect(screen.getByText("Details")).toBeTruthy();
  });

  it("renders action when provided", () => {
    render(
      <DecisionBanner variant="note" title="Title" action={<button>Act</button>} />,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
  });

  it("allows overriding role", () => {
    render(<DecisionBanner variant="blocked" title="T" role="status" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});