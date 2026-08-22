import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatrixMobileCard } from "../matrix-mobile-card";

describe("MatrixMobileCard", () => {
  it("renders title, subtitle, and one chip per cell with its round label and value", () => {
    render(
      <MatrixMobileCard
        title="Ada Lovelace"
        subtitle="Blue"
        cells={[
          { key: "r1", roundLabel: "R1", value: "Core", className: "bg-emerald-900/60 text-emerald-200" },
          { key: "r2", roundLabel: "R2", value: "Sup", className: "bg-amber-900/60 text-amber-200" },
        ]}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Blue")).toBeTruthy();
    expect(screen.getByText("R1")).toBeTruthy();
    expect(screen.getByText("Core")).toBeTruthy();
    expect(screen.getByText("R2")).toBeTruthy();
    expect(screen.getByText("Sup")).toBeTruthy();
  });

  it("renders a note when provided", () => {
    render(
      <MatrixMobileCard title="Ada" cells={[]} note="High recent participation" />,
    );
    expect(screen.getByText("High recent participation")).toBeTruthy();
  });

  it("does not render a totals row when totals is omitted", () => {
    const { container } = render(<MatrixMobileCard title="Ada" cells={[]} />);
    expect(container.querySelector("dl")).toBeNull();
  });

  it("renders totals when provided", () => {
    render(
      <MatrixMobileCard
        title="Ada"
        cells={[]}
        totals={[
          { label: "Core", value: 5 },
          { label: "Sup", value: 2 },
        ]}
      />,
    );
    expect(screen.getByText("Core")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Sup")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("wraps cells without introducing scroll — flex-wrap container", () => {
    render(
      <MatrixMobileCard
        title="Ada"
        cells={[{ key: "r1", roundLabel: "R1", value: "Core", className: "" }]}
      />,
    );
    const chipContainer = screen.getByText("R1").parentElement?.parentElement;
    expect(chipContainer?.className).toContain("flex-wrap");
    expect(chipContainer?.className).not.toContain("overflow-x-auto");
  });
});
