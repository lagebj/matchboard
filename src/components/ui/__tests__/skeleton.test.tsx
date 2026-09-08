import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, PageSkeleton } from "../skeleton";

describe("PageSkeleton", () => {
  it("exposes an accessible loading status without a spinner", () => {
    render(<PageSkeleton />);
    const status = screen.getByRole("status", { name: "Loading" });
    expect(status).toHaveAttribute("aria-busy", "true");
    // Layout-preserving: it renders placeholder blocks, not a centred spinner.
    expect(status.className).not.toMatch(/items-center|justify-center|animate-spin/);
    expect(status.querySelectorAll(".animate-pulse").length).toBeGreaterThan(1);
  });

  it("renders the requested number of content rows", () => {
    const { container } = render(<PageSkeleton rows={3} />);
    // 2 header blocks + 3 rows.
    expect(container.querySelectorAll(".animate-pulse").length).toBe(5);
  });
});

describe("Skeleton", () => {
  it("is decorative (aria-hidden) and accepts sizing classes", () => {
    const { container } = render(<Skeleton className="h-10 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-24");
  });
});
