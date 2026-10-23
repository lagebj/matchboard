import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B07TrivialFactPage from "../page";

// W4-R8 (independent-review remediation): this page no longer mounts `CompletedMatchAdvisorPanel`
// at all — `advisorViewModel` is the real, production-reachable `null` state, so no mock is
// needed here (nothing "use server"-wired is imported by this page any more).

function renderPage() {
  return render(
    <ThemeProvider>
      <B07TrivialFactPage />
    </ThemeProvider>,
  );
}

describe("B07-B trivial-fact page", () => {
  it("shows the hat-trick factually in the Match story and Key figures", () => {
    renderPage();
    expect(screen.getAllByText("4-1").length).toBeGreaterThan(0);
    expect(screen.getByText("6 recorded events")).toBeInTheDocument();
    expect(screen.getByText("Noah goals")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows no Assistant Coach content of any kind — the real production fallback text instead", () => {
    renderPage();
    expect(screen.queryByText("AI Advisor")).not.toBeInTheDocument();
    expect(screen.queryByText(/No historical pattern identified/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Supported")).not.toBeInTheDocument();
    expect(screen.queryByText("Next focus")).not.toBeInTheDocument();
    // Copied verbatim from after-match-overview.tsx:208, not invented — see page.tsx's doc comment.
    expect(screen.getByText("No coaching intent or review recorded for this match.")).toBeInTheDocument();
  });

  it("does not repeat the hat-trick as a finding — no insight content of any kind renders", () => {
    renderPage();
    expect(screen.queryByText(/pattern identified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recurring/i)).not.toBeInTheDocument();
  });

  it("the hat-trick is reported factually", () => {
    renderPage();
    expect(document.body.textContent).toMatch(/hat-?trick/i);
  });

  it("never shows a fabricated Player of the Match or player ranking", () => {
    renderPage();
    expect(document.body.textContent).not.toMatch(/player of the match/i);
  });

  it("every interactive element has an accessible name", () => {
    renderPage();
    const buttons = screen.queryAllByRole("button");
    for (const button of buttons) {
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
