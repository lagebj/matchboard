import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpDrawer, HelpButton } from "../help-drawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/o/fjordvik-fk/rounds/abc123",
}));

/**
 * Contract test for the contextual Help drawer (ADR-0103, user-documentation-experience
 * Phase 5). Covers: closed by default, resolves the correct docs context from the current
 * route, renders a same-origin iframe (never a second MDX renderer), Escape closes it, and
 * "Open full documentation" links to the canonical public URL.
 */
describe("HelpDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<HelpDrawer isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a same-origin iframe pointed at the compact embed of the docs page matching the current route", () => {
    render(<HelpDrawer isOpen={true} onClose={() => {}} />);
    const iframe = screen.getByTitle(/Matchboard documentation/i) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    // /docs/embed/** (not /docs/**) -- the compact embed skips DocsLayout's sidebar/top-nav
    // chrome, which has nowhere useful to go inside the drawer's ~440px panel. See
    // docs/[[...slug]]/layout.tsx.
    expect(iframe.getAttribute("src")).toBe("/docs/embed/squad-planning");
  });

  it("shows the resolved context label in the header", () => {
    render(<HelpDrawer isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/Help — Squad planning/)).toBeInTheDocument();
  });

  it("links 'Open full documentation' to the canonical public docs URL", () => {
    render(<HelpDrawer isOpen={true} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /Open full documentation/i });
    expect(link).toHaveAttribute("href", "/docs/squad-planning");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<HelpDrawer isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<HelpDrawer isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close help/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = vi.fn();
    render(<HelpDrawer isOpen={true} onClose={onClose} />);
    // Portalled to document.body (see help-drawer.tsx) -- not a descendant of render()'s own
    // container, so query document.body directly rather than `container`.
    const backdrop = document.body.querySelector("[aria-hidden='true']");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("HelpButton", () => {
  it("calls onClick and is labelled for accessibility", () => {
    const onClick = vi.fn();
    render(<HelpButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /open help/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
