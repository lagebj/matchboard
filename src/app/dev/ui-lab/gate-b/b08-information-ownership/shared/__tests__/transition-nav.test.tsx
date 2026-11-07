import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { B08TransitionNav, type B08StageKey } from "../transition-nav";

const B08_DIR = path.join(process.cwd(), "src/app/dev/ui-lab/gate-b/b08-information-ownership");

const STOPS: { key: B08StageKey; label: string; href: string }[] = [
  { key: "before", label: "Before", href: "/dev/ui-lab/gate-b/b08-information-ownership/before" },
  { key: "live", label: "Live", href: "/dev/ui-lab/gate-b/b08-information-ownership/live" },
  { key: "after", label: "After", href: "/dev/ui-lab/gate-b/b08-information-ownership/after" },
  { key: "report-draft", label: "Report · Draft", href: "/dev/ui-lab/gate-b/b08-information-ownership/report-draft" },
  { key: "report-completed", label: "Report · Completed", href: "/dev/ui-lab/gate-b/b08-information-ownership/report-completed" },
];

describe("B08TransitionNav", () => {
  it("is visually distinct dev-only chrome, never mistaken for a production action", () => {
    render(<B08TransitionNav current="before" />);
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "B08 scenario navigator" })).toBeInTheDocument();
  });

  for (const stop of STOPS) {
    it(`renders all 5 real route links and marks "${stop.key}" as the distinguishable current stage`, () => {
      render(<B08TransitionNav current={stop.key} />);
      for (const other of STOPS) {
        const link = screen.getByRole("link", { name: other.label });
        expect(link).toHaveAttribute("href", other.href);
        if (other.key === stop.key) {
          expect(link).toHaveAttribute("aria-current", "page");
        } else {
          expect(link).not.toHaveAttribute("aria-current");
        }
      }
    });
  }
});

describe("B08 pages — no inert or fake navigation (structural guarantee)", () => {
  const pages = ["before/page.tsx", "live/page.tsx", "after/page.tsx", "report-draft/page.tsx", "report-completed/page.tsx"];

  it("none of the 5 real candidate pages contain a literal href=\"#\" or onClick-only fake link", () => {
    for (const page of pages) {
      const fullPath = path.join(B08_DIR, page);
      const source = readFileSync(fullPath, "utf8");
      expect(source).not.toMatch(/href=["']#["']/);
    }
  });
});
