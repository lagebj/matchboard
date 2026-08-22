import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "../bottom-sheet";

describe("BottomSheet", () => {
  it("does not render when isOpen is false", () => {
    render(
      <BottomSheet isOpen={false} onClose={() => {}} title="Hidden">
        Content
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders when isOpen is true", () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} title="Move player">
        Content inside
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Move player")).toBeTruthy();
    expect(screen.getByText("Content inside")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} title="T" description="Desc">
        Content
      </BottomSheet>,
    );
    expect(screen.getByText("Desc")).toBeTruthy();
  });

  it("renders footer when provided", () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} title="T" footer={<button>Confirm</button>}>
        Content
      </BottomSheet>,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose} title="Closeable">
        Body
      </BottomSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose} title="Escape">
        Body
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <BottomSheet isOpen={true} onClose={onClose} title="Backdrop">
        Body
      </BottomSheet>,
    );
    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sets aria-modal and aria-labelledby", () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} title="A11y">
        Body
      </BottomSheet>,
    );
    const sheet = screen.getByRole("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(sheet.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("uses custom ariaLabel", () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} title="T" ariaLabel="Custom label">
        Body
      </BottomSheet>,
    );
    const sheet = screen.getByRole("dialog");
    expect(sheet.getAttribute("aria-label")).toBe("Custom label");
  });
});
