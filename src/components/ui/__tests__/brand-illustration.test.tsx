import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BrandIllustration } from "../brand-illustration";

describe("BrandIllustration (performance: single-fetch light/dark swap)", () => {
  it("renders exactly one <img> and one <source>, not two <img> tags", () => {
    const { container } = render(<BrandIllustration name="matchdayPrepSketch" />);
    expect(container.querySelectorAll("img").length).toBe(1);
    expect(container.querySelectorAll("source").length).toBe(1);
  });

  it("wires the dark variant to the source via a prefers-color-scheme media query", () => {
    const { container } = render(<BrandIllustration name="matchdayPrepSketch" />);
    const source = container.querySelector("source");
    expect(source?.getAttribute("media")).toBe("(prefers-color-scheme: dark)");
    expect(source?.getAttribute("srcset")).toBeTruthy();
  });

  it("hides decorative illustrations from assistive tech by default", () => {
    const { container } = render(<BrandIllustration name="matchdayPrepSketch" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("exposes a real alt text when decorative is false", () => {
    const { container } = render(
      <BrandIllustration name="matchdayPrepSketch" decorative={false} alt="Matchday prep sketch" />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("aria-hidden")).toBe("false");
    expect(img?.getAttribute("alt")).toBe("Matchday prep sketch");
  });

  it("lazy-loads since these are always decorative, never above-the-fold critical content", () => {
    const { container } = render(<BrandIllustration name="matchdayPrepSketch" />);
    expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
  });
});
