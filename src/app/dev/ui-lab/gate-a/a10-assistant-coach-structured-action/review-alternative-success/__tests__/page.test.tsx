import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import A10ReviewAlternativeSuccessPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <A10ReviewAlternativeSuccessPage />
    </ThemeProvider>,
  );
}

function openAndSelect() {
  fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
  fireEvent.click(screen.getByTestId("lineup-proposal-row"));
}

function resolveToSuccess() {
  openAndSelect();
  fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
}

describe("A10-review-alternative-success page", () => {
  it("opens exactly one inline inspector on desktop, aria-modal false", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "false");
  });

  it("shows the candidate name, rationale, and limitations before any selection", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    expect(screen.getByText("Tobias · №12")).toBeInTheDocument();
    expect(screen.getByText(/makes this a possible candidate for review/)).toBeInTheDocument();
    expect(screen.getByText(/Limitation: No completed-match minutes recorded/)).toBeInTheDocument();
  });

  it("the evidence inspector lists each source's kind, field, coverage, and what it supports", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    const inspector = screen.getByTestId("proposal-evidence-inspector");
    expect(inspector).toHaveTextContent("Based on 3 cited sources");
    const sources = within(inspector).getAllByTestId("proposal-evidence-source");
    expect(sources).toHaveLength(3);
    expect(sources[0]).toHaveTextContent("Recorded match fact");
    expect(sources[0]).toHaveTextContent("RCM slot occupant: None — unfilled");
    expect(sources[0]).toHaveTextContent("Supports: Confirms the target slot is genuinely open");
    expect(sources[1]).toHaveTextContent("Coach-declared");
    expect(sources[2]).toHaveTextContent("Not recorded");
  });

  describe("evidence inspection is independent of candidate selection (independent review finding N2)", () => {
    it("the evidence inspector and the Select proposal control are siblings, not nested — no interactive element contains another", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      const selectButton = screen.getByRole("button", { name: "Select proposal" });
      const inspector = screen.getByTestId("proposal-evidence-inspector");
      // Neither interactive element may be a DOM descendant of the other.
      expect(selectButton.contains(inspector)).toBe(false);
      expect(inspector.contains(selectButton)).toBe(false);
      // A <details> (and its <summary>) must never be nested inside a <button>.
      expect(selectButton.querySelector("details")).toBeNull();
      expect(selectButton.closest("details")).toBeNull();
    });

    it("expanding the evidence disclosure does not select the candidate or create a draft", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      const summary = within(screen.getByTestId("proposal-evidence-inspector")).getByText(/Based on 3 cited sources/);
      fireEvent.click(summary);
      expect(screen.getByRole("button", { name: "Select proposal" })).toBeInTheDocument();
      expect(screen.queryByTestId("lineup-diff-preview")).not.toBeInTheDocument();
    });

    it("collapsing an already-expanded evidence disclosure does not deselect an existing selection", () => {
      mockViewport(true);
      renderPage();
      openAndSelect();
      expect(screen.getByTestId("lineup-diff-preview")).toBeInTheDocument();
      const summary = within(screen.getByTestId("proposal-evidence-inspector")).getByText(/Based on 3 cited sources/);
      fireEvent.click(summary); // expand
      fireEvent.click(summary); // collapse
      expect(screen.getByRole("button", { name: "Selected ✓" })).toBeInTheDocument();
      expect(screen.getByTestId("lineup-diff-preview")).toBeInTheDocument();
    });

    it("inspecting evidence never mutates the authoritative pitch", () => {
      mockViewport(true);
      renderPage();
      const pitchBefore = screen.getAllByTestId("touchline-planning-pitch")[0].textContent;
      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      const summary = within(screen.getByTestId("proposal-evidence-inspector")).getByText(/Based on 3 cited sources/);
      fireEvent.click(summary);
      const pitchAfter = screen.getAllByTestId("touchline-planning-pitch")[0].textContent;
      expect(pitchAfter).toBe(pitchBefore);
    });

    it("the Select proposal control has its own accessible name, reachable independently of the evidence disclosure's own accessible name", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      expect(screen.getByRole("button", { name: "Select proposal" })).toBeInTheDocument();
      expect(screen.getByText(/Based on 3 cited sources/)).toBeInTheDocument();
    });

    it("holds on mobile (bottom sheet) too — no nested interactive elements, expanding evidence does not select", () => {
      mockViewport(false);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      const selectButton = screen.getByRole("button", { name: "Select proposal" });
      const inspector = screen.getByTestId("proposal-evidence-inspector");
      expect(selectButton.contains(inspector)).toBe(false);
      expect(inspector.contains(selectButton)).toBe(false);
      fireEvent.click(within(inspector).getByText(/Based on 3 cited sources/));
      expect(screen.getByRole("button", { name: "Select proposal" })).toBeInTheDocument();
    });
  });

  it("shows the complete before/after diff — including the proposed player — and expected-consequence disclaimer once selected (independent review finding N3)", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    const preview = screen.getByTestId("lineup-diff-preview");
    expect(preview.textContent).toMatch(/RCM:/);
    expect(preview.textContent).toMatch(/Empty.*Tobias/);
    expect(preview.textContent).toMatch(/Draft, not yet applied\./);
    expect(preview.textContent).toMatch(/advisory only, not a guaranteed outcome/);
  });

  it("the preview's proposed player matches the player the submitted/applied operation actually assigns", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    expect(screen.getByTestId("lineup-diff-preview").textContent).toMatch(/Tobias/);
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    expect(within(pitches[0]).getByText("Tobias")).toBeInTheDocument();
  });

  it("Apply proposal enters PENDING, then resolving applies SUCCESS and the pitch reflects Tobias at RCM exactly once", () => {
    mockViewport(true);
    renderPage();
    resolveToSuccess();
    expect(screen.getByText("Saved (simulated)")).toBeInTheDocument();

    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    expect(within(pitches[0]).getByText("Tobias")).toBeInTheDocument();
  });

  describe("PENDING blocks Discard, not just Close (independent review finding R3)", () => {
    it("the Discard draft control is not rendered at all while PENDING", () => {
      mockViewport(true);
      renderPage();
      openAndSelect();
      expect(screen.getByRole("button", { name: "Discard draft" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
      expect(screen.getByText("Applying… (fixture simulation)")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Discard draft" })).not.toBeInTheDocument();
    });

    it("Close and Escape remain blocked during PENDING, exactly as before", () => {
      mockViewport(true);
      renderPage();
      openAndSelect();
      fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("an already-applied proposal cannot be re-applied (independent review finding R4)", () => {
    it("reopening after a successful close shows an already-applied state, not a fresh actionable proposal", () => {
      mockViewport(true);
      renderPage();
      resolveToSuccess();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      expect(screen.getByTestId("proposal-already-applied")).toHaveTextContent(/Tobias is now assigned to RCM/);
      expect(screen.queryByTestId("lineup-proposal-card")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply proposal" })).not.toBeInTheDocument();
    });

    it("the authoritative pitch is not mutated a second time by reopening", () => {
      mockViewport(true);
      renderPage();
      resolveToSuccess();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      const pitchBeforeReopen = screen.getAllByTestId("touchline-planning-pitch")[0].textContent;

      fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
      const pitchAfterReopen = screen.getAllByTestId("touchline-planning-pitch")[0].textContent;
      expect(pitchAfterReopen).toBe(pitchBeforeReopen);
    });
  });

  it("never renders a navigation link for the review/confirm/close controls — only buttons", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
  });

  it("closes on Escape and restores focus to the Review lineup trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByRole("button", { name: "Review lineup" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
