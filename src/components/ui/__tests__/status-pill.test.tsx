import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { StatusPill } from "../status-pill";

describe("StatusPill", () => {
  it("renders text content", () => {
    render(<StatusPill>Core</StatusPill>);
    expect(screen.getByText("Core")).toBeTruthy();
  });

  it("applies neutral variant by default", () => {
    const { container } = render(<StatusPill>Default</StatusPill>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-[var(--surface-muted)]");
  });

  it("applies success variant classes", () => {
    const { container } = render(<StatusPill variant="success">OK</StatusPill>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-[var(--accent-subtle)]");
  });

  it("applies danger variant classes", () => {
    const { container } = render(<StatusPill variant="danger">Blocked</StatusPill>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-[var(--danger-subtle)]");
  });

  it("applies role-specific variants (support, development, core)", () => {
    const { container: s } = render(<StatusPill variant="support">S</StatusPill>);
    expect((s.firstElementChild as HTMLElement).className).toContain("bg-[var(--info-subtle)]");

    const { container: d } = render(<StatusPill variant="development">D</StatusPill>);
    expect((d.firstElementChild as HTMLElement).className).toContain("bg-[var(--dev-subtle)]");

    const { container: c } = render(<StatusPill variant="core">C</StatusPill>);
    expect((c.firstElementChild as HTMLElement).className).toContain("bg-[var(--accent-subtle)]");
  });

  it("applies size sm by default with correct classes", () => {
    const { container } = render(<StatusPill>Small</StatusPill>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("h-5");
  });

  it("applies size md classes", () => {
    const { container } = render(<StatusPill size="md">Medium</StatusPill>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("h-6");
  });

  it("renders icon when provided", () => {
    render(<StatusPill icon={CheckCircle2}>With Icon</StatusPill>);
    expect(screen.getByText("With Icon")).toBeTruthy();
    expect(document.querySelector("svg")).toBeTruthy();
  });
});