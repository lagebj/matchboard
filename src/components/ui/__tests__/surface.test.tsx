import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Surface } from "../surface";

describe("Surface", () => {
  it("renders default variant with border and background", () => {
    const { container } = render(<Surface>Hello</Surface>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("rounded-xl");
    expect(el.className).toContain("border");
    expect(el.className).toContain("bg-[var(--surface-base)]");
    expect(el.textContent).toBe("Hello");
  });

  it("renders raised variant with shadow", () => {
    const { container } = render(<Surface variant="raised">Hi</Surface>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("shadow");
    expect(el.className).toContain("bg-[var(--surface-raised)]");
  });

  it("applies padding classes", () => {
    const { container } = render(<Surface padding="lg">Padded</Surface>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-5");
  });

  it("renders as custom element via as prop", () => {
    const { container } = render(<Surface as="article">Article</Surface>);
    expect(container.firstElementChild?.tagName).toBe("ARTICLE");
  });

  it("merges custom className", () => {
    const { container } = render(
      <Surface className="extra-class">Test</Surface>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("extra-class");
  });

  it("renders all semantic variants without error", () => {
    const variants = [
      "default",
      "raised",
      "subtle",
      "active",
      "danger",
      "warning",
      "success",
      "info",
    ] as const;
    for (const variant of variants) {
      const { container } = render(
        <Surface variant={variant}>Content</Surface>,
      );
      expect(container.firstElementChild).toBeTruthy();
    }
  });
});