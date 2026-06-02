import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerChip } from "../player-chip";

describe("PlayerChip", () => {
  it("renders player name", () => {
    render(<PlayerChip name="Ada Lovelace" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });

  it("renders position when provided", () => {
    render(<PlayerChip name="Test Player" position="FW" />);
    expect(screen.getByText("FW")).toBeTruthy();
  });

  it("does not render position when null", () => {
    render(<PlayerChip name="No Position" position={null} />);
    expect(screen.queryByText("FW")).toBeNull();
  });

  it("renders availability label for INJURED", () => {
    render(<PlayerChip name="Injured" availability="INJURED" />);
    expect(screen.getByText("unavailable")).toBeTruthy();
  });

  it("renders availability label for SICK", () => {
    render(<PlayerChip name="Sick" availability="SICK" />);
    expect(screen.getByText("sick")).toBeTruthy();
  });

  it("renders availability label for AWAY", () => {
    render(<PlayerChip name="Away" availability="AWAY" />);
    expect(screen.getByText("away")).toBeTruthy();
  });

  it("does not show availability for OK", () => {
    render(<PlayerChip name="OK" availability="OK" />);
    expect(screen.queryByText("unavailable")).toBeNull();
    expect(screen.queryByText("sick")).toBeNull();
  });

  it("renders markers", () => {
    render(
      <PlayerChip
        name="Marked"
        markers={[
          { label: "OVR", title: "Override", tone: "warning" },
          { label: "CR", title: "Confidence rebuild", tone: "info" },
        ]}
      />,
    );
    expect(screen.getByText("OVR")).toBeTruthy();
    expect(screen.getByText("CR")).toBeTruthy();
  });

  it("renders remove button when onRemove is provided", () => {
    const onRemove = vi.fn();
    render(<PlayerChip name="Removable" onRemove={onRemove} />);
    const removeBtn = screen.getByRole("button", { name: /remove removable/i });
    expect(removeBtn).toBeTruthy();
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("does not render remove button when disabled", () => {
    const onRemove = vi.fn();
    render(<PlayerChip name="Disabled" onRemove={onRemove} disabled />);
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  it("renders drag handle when draggable", () => {
    const { container } = render(
      <PlayerChip name="Drag" draggable />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("applies role accent for SUPPORT", () => {
    const { container } = render(<PlayerChip name="Support" role="SUPPORT" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("before:bg-[var(--info)]");
  });

  it("applies role accent for CORE", () => {
    const { container } = render(<PlayerChip name="Core" role="CORE" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("before:bg-[var(--accent)]");
  });
});