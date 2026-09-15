import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TeamIdentityStrip } from "../team-identity-strip";

describe("TeamIdentityStrip (League Operating Surface, 05_TEAM_KIT_IDENTITY_STRIP.md)", () => {
  it("renders the canonical RED hex for a RED kit colour", () => {
    const { container } = render(<TeamIdentityStrip kitColor="RED" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.style.backgroundColor).toBe("rgb(213, 52, 44)");
  });

  it("renders the canonical BLUE hex for a BLUE kit colour", () => {
    const { container } = render(<TeamIdentityStrip kitColor="BLUE" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.style.backgroundColor).toBe("rgb(29, 79, 168)");
  });

  it("falls back to the neutral treatment for null/invalid colours", () => {
    const { container } = render(<TeamIdentityStrip kitColor={null} />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.style.backgroundColor).toBe("");
    expect(strip.className).toContain("bg-[var(--tl-widget-border)]");
  });

  it("falls back to the neutral treatment for an unrecognised stored value", () => {
    const { container } = render(<TeamIdentityStrip kitColor="NOT_A_REAL_COLOR" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.style.backgroundColor).toBe("");
  });

  it("adds a hairline outline for BLACK so it stays visible on a dark surface", () => {
    const { container } = render(<TeamIdentityStrip kitColor="BLACK" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.className).toContain("outline");
  });

  it("adds a hairline outline for WHITE so it stays visible on a light surface", () => {
    const { container } = render(<TeamIdentityStrip kitColor="WHITE" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.className).toContain("outline");
  });

  it("does not add an outline for an ordinary saturated colour", () => {
    const { container } = render(<TeamIdentityStrip kitColor="GREEN" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.className).not.toContain("outline outline-1");
  });

  it("is decorative and carries no accessible name", () => {
    const { container } = render(<TeamIdentityStrip kitColor="RED" />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.getAttribute("aria-hidden")).toBe("true");
  });
});
