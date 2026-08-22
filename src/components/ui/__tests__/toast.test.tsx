import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../toast";

function Harness({
  actionLabel,
  onAction,
  duration,
}: {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}) {
  const { showToast } = useToast();
  return (
    <button
      onClick={() =>
        showToast({ message: "Player moved to Blue", actionLabel, onAction, duration })
      }
    >
      Trigger
    </button>
  );
}

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows nothing initially", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a toast after showToast is called", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByText("Player moved to Blue")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders the action button, calls onAction, and dismisses when clicked", () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Harness actionLabel="Undo" onAction={onAction} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText("Player moved to Blue")).toBeNull();
  });

  it("dismisses when the dismiss button is clicked", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Player moved to Blue")).toBeNull();
  });

  it("auto-dismisses after the duration elapses", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Harness duration={1000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByText("Player moved to Blue")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Player moved to Blue")).toBeNull();
  });

  it("pauses the auto-dismiss timer on hover and resumes on mouse leave", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Harness duration={1000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    const toastEl = screen.getByRole("status");
    fireEvent.mouseEnter(toastEl);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Player moved to Blue")).toBeTruthy();

    fireEvent.mouseLeave(toastEl);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Player moved to Blue")).toBeNull();
  });

  it("throws when useToast is used outside a provider", () => {
    function Bare() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow();
    spy.mockRestore();
  });
});
