import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D09SupersededLineagePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D09SupersededLineagePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 extension — D09 superseded lineage", () => {
  it("preserves the original statement's wording verbatim rather than rewriting it", () => {
    renderPage();
    expect(screen.getByText("First touch was inconsistent under pressure in the second half.")).toBeInTheDocument();
  });

  it("marks the original as Superseded and the resubmission as Active", () => {
    renderPage();
    expect(screen.getByText("Superseded")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the active version's tentative wording distinctly from the superseded explicit one", () => {
    renderPage();
    expect(screen.getByText(/though it was a wet pitch/)).toBeInTheDocument();
    expect(screen.getByText("Tentative")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => (element?.tagName === "SPAN" && !!element.textContent?.startsWith("Explicit")) ?? false),
    ).toBeInTheDocument();
  });

  it("simulates Retract on the active entry: it becomes Superseded, no new entry replaces it, no record is written", async () => {
    renderPage();
    const activeStatement = "First touch seemed a little heavy a couple of times, though it was a wet pitch.";
    await userEvent.click(screen.getByRole("button", { name: "Retract" }));
    expect(screen.getByText(/no database write occurs/)).toBeInTheDocument();
    // The previously active statement is now shown struck through (superseded), and no third
    // entry was created to replace it — retraction leaves nothing active, matching the real
    // recordDeterministicExtraction() "resubmit with zero observations" behavior.
    expect(screen.getByText(activeStatement)).toHaveClass("line-through");
    expect(screen.getAllByText("Superseded")).toHaveLength(2);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("simulates Edit on the active entry: the edited wording becomes a new active entry, the prior wording remains visible", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "First touch was clean and composed in the second half after all.");
    await userEvent.click(screen.getByRole("button", { name: "Save edit (simulated)" }));

    expect(screen.getByText("First touch was clean and composed in the second half after all.")).toBeInTheDocument();
    // Prior wording (the edited entry's own earlier statement) remains visible, superseded, not deleted.
    expect(screen.getByText(/though it was a wet pitch/)).toHaveClass("line-through");
  });
});
