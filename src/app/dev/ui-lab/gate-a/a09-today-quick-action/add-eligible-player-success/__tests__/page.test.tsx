import { describe, it, expect } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AddEligiblePlayerSuccessPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AddEligiblePlayerSuccessPage />
    </ThemeProvider>,
  );
}

/** Same as `renderPage()`, but wrapped in `<StrictMode>` — see `shared/__tests__/fixture-
 * operation.test.tsx` for why this matters: React double-invokes effects/updaters in dev mode,
 * and `useFixtureOperation`'s own state-updater purity has already been caught failing this way
 * once. This confirms the page-level close/reopen lifecycle (not just the hook in isolation)
 * holds under the same double-invocation. */
function renderPageStrict() {
  return render(
    <StrictMode>
      <ThemeProvider>
        <AddEligiblePlayerSuccessPage />
      </ThemeProvider>
    </StrictMode>,
  );
}

describe("A09-S1 add-eligible-player-success page", () => {
  it("never renders a link for the action controls — only buttons, no navigation", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    expect(screen.queryAllByRole("link").length).toBeLessThanOrEqual(1); // only the back-link to the family index
  });

  it("walks open → select → preview → confirm → PENDING → SUCCESS, updating the planned-squad count only after resolve", () => {
    mockViewport(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/);

    fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
    expect(within(dialog).getByTestId("today-diff-preview").textContent).toMatch(/8\/9 → 9\/9/);
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/); // not yet saved

    fireEvent.click(within(dialog).getByRole("button", { name: "Add player" })); // the Confirm button shares the actionLabel text
    expect(within(dialog).getByText("Saving… (fixture simulation)")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));
    expect(within(dialog).getByText("Saved (simulated)")).toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/9 \/ 9/);
  });

  it("rejects a double submit — clicking Confirm twice before resolving still lands on exactly one SUCCESS", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
    const confirmButton = within(dialog).getByRole("button", { name: "Add player" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton); // second submit while PENDING — guarded no-op
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));
    expect(within(dialog).getByText("Saved (simulated)")).toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/9 \/ 9/);
    expect(within(dialog).queryAllByText("Saved (simulated)")).toHaveLength(1);
  });

  it("Escape with a dirty draft opens the discard-confirmation prompt instead of closing, and focus returns to the trigger only after confirming", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByRole("button", { name: "Add player" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("today-candidate-row"));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // still open

    fireEvent.click(screen.getByTestId("keep-editing"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("today-diff-preview")).toBeInTheDocument(); // draft preserved

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens a mobile bottom sheet instead, never both presentations at once", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "true");
  });

  describe("close/reopen lifecycle (regression: close() previously left the draft and operation status stuck for the next session)", () => {
    it("a discarded draft does not reappear after close and reopen — clean editor, count unchanged", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      let dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
      expect(within(dialog).getByTestId("today-diff-preview")).toBeInTheDocument();

      // Escape -> discard-confirmation prompt -> explicit "Discard and close".
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
      expect(within(dialog).getByTestId("today-candidate-row")).toHaveAttribute("aria-pressed", "false");
      expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/);
      expect(within(dialog).queryByText("Saved (simulated)")).not.toBeInTheDocument();
    });

    it("a no-draft close (nothing selected) closes immediately with no discard prompt, and reopening starts clean", () => {
      mockViewport(true);
      renderPage();
      const trigger = screen.getByRole("button", { name: "Add player" });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
      expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/);
    });

    it("after a successful save, closing and reopening keeps the saved authoritative count and resets operation feedback to a fresh editor", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      let dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
      fireEvent.click(within(dialog).getByRole("button", { name: "Add player" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));
      expect(within(dialog).getByTestId("today-count").textContent).toMatch(/9 \/ 9/);

      // SUCCESS leaves no draft, so close() fires immediately — no discard prompt.
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      dialog = screen.getByRole("dialog");
      // The successful save is retained...
      expect(within(dialog).getByTestId("today-count").textContent).toMatch(/9 \/ 9/);
      // ...but the stale "Saved (simulated)" feedback and the exhausted candidate selection do not
      // leak into the new session.
      expect(within(dialog).queryByText("Saved (simulated)")).not.toBeInTheDocument();
      expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
      expect(within(dialog).getByTestId("today-candidate-row")).toHaveAttribute("aria-pressed", "false");
    });

    it("the same discard/reopen behavior holds on the mobile sheet", () => {
      mockViewport(false);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      let dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      fireEvent.click(within(dialog).getByTestId("today-candidate-row"));

      // The sheet's own close control requests the same dirty-close guard as desktop.
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
      expect(within(dialog).getByTestId("today-candidate-row")).toHaveAttribute("aria-pressed", "false");
    });

    it("under React.StrictMode: full close/reopen-after-SUCCESS lifecycle still holds", () => {
      mockViewport(true);
      renderPageStrict();
      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      let dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
      fireEvent.click(within(dialog).getByRole("button", { name: "Add player" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));
      expect(within(dialog).getByTestId("today-count").textContent).toMatch(/9 \/ 9/);

      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Add player" }));
      dialog = screen.getByRole("dialog");
      expect(within(dialog).getByTestId("today-count").textContent).toMatch(/9 \/ 9/);
      expect(within(dialog).queryByText("Saved (simulated)")).not.toBeInTheDocument();
      expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
    });
  });
});
