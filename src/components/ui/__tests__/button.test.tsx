import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";

describe("Button", () => {
  it("renders as button by default", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe("BUTTON");
    expect((btn as HTMLButtonElement).type).toBe("button");
  });

  it("renders as anchor when as='a'", () => {
    render(<Button as="a" href="/test">Link</Button>);
    const link = screen.getByRole("link", { name: "Link" });
    expect(link.tagName).toBe("A");
    expect(link).toBeTruthy();
  });

  it("applies primary variant classes", () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-[var(--accent-subtle)]");
  });

  it("applies danger variant classes", () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-[var(--danger-subtle)]");
  });

  it("applies size classes", () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("h-7");
  });

  it("applies fullWidth class", () => {
    render(<Button fullWidth>Wide</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("w-full");
  });

  it("renders leading and trailing icons", () => {
    const Lead = () => <span data-testid="lead">L</span>;
    const Trail = () => <span data-testid="trail">T</span>;
    render(<Button leadingIcon={<Lead />} trailingIcon={<Trail />}>WithIcons</Button>);
    expect(screen.getByTestId("lead")).toBeTruthy();
    expect(screen.getByTestId("trail")).toBeTruthy();
  });

  it("passes through extra HTML attributes", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});