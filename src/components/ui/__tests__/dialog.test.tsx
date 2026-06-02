import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "../dialog";

describe("Dialog", () => {
  it("does not render when isOpen is false", () => {
    render(
      <Dialog isOpen={false} onClose={() => {}} title="Hidden">
        Content
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders when isOpen is true", () => {
    render(
      <Dialog isOpen={true} onClose={() => {}} title="Visible Dialog">
        Content inside
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Visible Dialog")).toBeTruthy();
    expect(screen.getByText("Content inside")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(
      <Dialog isOpen={true} onClose={() => {}} title="T" description="Desc">
        Content
      </Dialog>,
    );
    expect(screen.getByText("Desc")).toBeTruthy();
  });

  it("renders footer when provided", () => {
    render(
      <Dialog isOpen={true} onClose={() => {}} title="T" footer={<button>Confirm</button>}>
        Content
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={onClose} title="Closeable">
        Body
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={onClose} title="Escape">
        Body
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sets aria-modal and aria-labelledby", () => {
    render(
      <Dialog isOpen={true} onClose={() => {}} title="A11y">
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("uses custom ariaLabel", () => {
    render(
      <Dialog isOpen={true} onClose={() => {}} title="T" ariaLabel="Custom label">
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Custom label");
  });

  it("applies size classes", () => {
    const { rerender } = render(
      <Dialog isOpen={true} onClose={() => {}} title="T" size="sm">
        Body
      </Dialog>,
    );
    expect(screen.getByRole("dialog").className).toContain("max-w-sm");

    rerender(
      <Dialog isOpen={true} onClose={() => {}} title="T" size="lg">
        Body
      </Dialog>,
    );
    expect(screen.getByRole("dialog").className).toContain("max-w-lg");
  });
});