import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StarRating } from "../star-rating";

describe("StarRating", () => {
  it("renders 'Not rated' placeholder for null", () => {
    const { container } = render(<StarRating overallValue={null} />);
    expect(container.textContent).toContain("—");
  });

  it("does not render five full stars for a 5.6 rating (regression)", () => {
    const { container } = render(<StarRating overallValue={5.6} />);
    const fullStars = container.querySelectorAll("span.text-amber-400");
    // 5.6 -> 2.8 stars -> rounds to 3.0 -> exactly 3 full amber stars, not 5.
    expect(fullStars.length).toBe(3);
  });

  it("renders a half-star overlay for a rating that rounds to a half value", () => {
    const { container } = render(<StarRating overallValue={7} />);
    // 7 -> 3.5 stars: 3 full stars + 1 half-star overlay span + 1 empty star.
    const fullStars = container.querySelectorAll(":scope > span > span.text-amber-400");
    expect(fullStars.length).toBe(3);
    const halfOverlay = container.querySelector("span.absolute.w-1\\/2");
    expect(halfOverlay).toBeTruthy();
  });

  it("has an accessible label describing the star value", () => {
    const { container } = render(<StarRating overallValue={10} />);
    const el = container.querySelector('[role="img"]');
    expect(el?.getAttribute("aria-label")).toBe("5 out of 5 stars");
  });

  it("clamps an out-of-range rating instead of throwing", () => {
    expect(() => render(<StarRating overallValue={20} />)).not.toThrow();
    const { container } = render(<StarRating overallValue={20} />);
    expect(container.querySelectorAll("span.text-amber-400").length).toBe(5);
  });
});
