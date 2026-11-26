import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D06ContradictionPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D06ContradictionPage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D06 genuine cross-source contradiction", () => {
  it("renders both contradicting sources, neither hidden nor silently resolved", () => {
    renderPage();
    expect(screen.getAllByText("Coach assessment, 20 Sep 2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Coach observation, 11 Oct 2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("the panel's own Contradicting line lists both disagreeing sources", () => {
    renderPage();
    expect(screen.getByText(/Contradicting: Coach assessment, 20 Sep 2026, Coach observation, 11 Oct 2026/)).toBeInTheDocument();
  });

  it("the source inspector resolves the earlier assessment's own real text", async () => {
    renderPage();
    const details = screen.getByText("Coach assessment, 20 Sep 2026").closest("details");
    expect(details).not.toBeNull();
    expect(details).toHaveTextContent(/needs another full season at right-back/);
  });

  it("classifies every source by its real kind — the earlier assessment and later observation are both coach judgments, never a generic 'Recorded fact'", () => {
    renderPage();
    // Every cited ref's label also appears in the panel's own plain-text Supporting/Contradicting
    // line, so each lookup below matches two elements — the <details> ancestor is what
    // disambiguates the inspector's own copy from the panel's.
    function detailsFor(textMatch: string | RegExp): HTMLDetailsElement {
      const matches = screen.getAllByText(textMatch);
      const found = matches.map((el) => el.closest("details")).find((d): d is HTMLDetailsElement => d !== null);
      if (!found) throw new Error(`No <details> ancestor found for ${String(textMatch)}`);
      return found;
    }

    expect(detailsFor("Coach assessment, 20 Sep 2026")).toHaveTextContent("Coach assessment");
    expect(detailsFor(/Coach observation, 11 Oct 2026/)).toHaveTextContent("Coach observation");
    expect(detailsFor(/Recorded position, 11 Oct 2026/)).toHaveTextContent("Recorded position");
    expect(detailsFor("Centre-back role minutes, previous 3 vs. latest 3 matches")).toHaveTextContent("Derived trend");
    expect(screen.queryByText("Recorded fact")).not.toBeInTheDocument();
  });

  it("does not resolve the later observation as superseding the earlier assessment — both remain visible and unreconciled", () => {
    renderPage();
    expect(screen.getByText(/does not assume the later note simply supersedes/)).toBeInTheDocument();
  });
});
