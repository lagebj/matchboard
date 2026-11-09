import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";

// Same real, disclosed jsdom-resolution blocker B07's own page tests mock around
// (`b07-assistant-coach-longitudinal/historical-pattern/__tests__/page.test.tsx`): the real
// `CompletedMatchAdvisorPanel` imports a "use server" actions module whose auth/db dependency
// chain doesn't resolve under this project's Vitest+jsdom component-test environment. This tests
// PAGE COMPOSITION against a faithful mock, not the real panel's own rendering — that component's
// own behavior is covered by its own test suite and by real CI browser captures.
vi.mock("@/components/ai/completed-match-advisor-panel", () => ({
  CompletedMatchAdvisorPanel: ({ viewModel }: { viewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" | "stale" }> }) => (
    <div data-testid="completed-match-advisor-panel">
      <span>AI Advisor</span>
      {viewModel.summary && <p>{viewModel.summary}</p>}
      {viewModel.insights.map((insight, i) => (
        <div key={i}>
          <p>{insight.title}</p>
          <p>{insight.body}</p>
          {insight.evidenceSources.length > 0 && <p>{insight.evidenceSources.join(" · ")}</p>}
        </div>
      ))}
    </div>
  ),
}));

const replaceMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string) => {
      replaceMock(url);
      searchParamsState.value = new URLSearchParams(url.split("?")[1] ?? "");
    },
    refresh: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParamsState.value,
}));

import B08AfterPage from "../page";

beforeEach(() => {
  // W5 second remediation: this page now reads `loadB08JourneyReport()`/
  // `loadFinishedB08JourneyEvents()` on mount — clear jsdom's shared `sessionStorage` before
  // every test so no test's own render can see a journey left behind by an earlier one (no
  // automatic reset between tests in the same file).
  window.sessionStorage.clear();
});

function renderPage(tab?: string, report?: "completed") {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (report) params.set("report", report);
  searchParamsState.value = params;
  replaceMock.mockClear();
  return render(
    <ThemeProvider>
      <B08AfterPage />
    </ThemeProvider>,
  );
}

describe("B08 After page", () => {
  it("has exactly one h1 and the B08 scenario navigator marking 'after' current", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "After", current: "page" })).toBeInTheDocument();
  });

  it("defaults to the Overview tab", () => {
    renderPage();
    expect(replaceMock).toHaveBeenCalledWith("?tab=overview");
  });

  it("Overview shows the final recorded result and a bounded match-story preview, not the full Events tab content inline", () => {
    renderPage("overview");
    expect(screen.getAllByText("2 - 1").length).toBeGreaterThan(0);
    expect(screen.getByText(/recorded events/)).toBeInTheDocument();
  });

  it("CORRECTED (ownership matrix §3): Overview's report-status widget is a status pill + link only — no reflection/timing/out-of-range detail duplicated here", () => {
    renderPage("overview");
    expect(screen.getByText("Needs work")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /See status/ })).toBeInTheDocument();
    // The detailed breakdown ("Timing review", "Out-of-range events", "Report status" section
    // header) stays owned exclusively by the After-match tab — not present on Overview.
    expect(screen.queryByText("Timing review")).not.toBeInTheDocument();
    expect(screen.queryByText("Out-of-range events")).not.toBeInTheDocument();
    expect(screen.queryByText("Report status")).not.toBeInTheDocument();
    // Discloses the intentional divergence from current production so a reviewer doesn't mistake
    // this for a capture bug.
    expect(screen.getByText(/deliberately lighter than production/)).toBeInTheDocument();
  });

  it("Overview shows the team reflection as an attributed coach observation, not a measured fact", () => {
    renderPage("overview");
    expect(screen.getByText(/Team reflection/)).toBeInTheDocument();
    expect(screen.getAllByText("STRONG").length).toBeGreaterThan(0);
  });

  it("Overview's Assistant Coach content is visually distinguishable from fact (its own labelled widget, evidence-sourced)", () => {
    renderPage("overview");
    expect(screen.getByText(/Coaching intent review/)).toBeInTheDocument();
    expect(screen.getByText(/Tighten defensive transition/)).toBeInTheDocument();
    expect(screen.getAllByText(/Match data|Coach observation/).length).toBeGreaterThan(0);
  });

  it("the After-match tab is the full report-status/integrity owner (Timing review, Out-of-range events present there)", () => {
    renderPage("after-match");
    expect(screen.getByText("Timing review")).toBeInTheDocument();
    expect(screen.getByText("Out-of-range events")).toBeInTheDocument();
  });

  it("the Events tab shows the full canonical chronology", () => {
    renderPage("events");
    expect(screen.getAllByText(/Vetle|Noah|Vollen/).length).toBeGreaterThan(0);
  });

  it("the Stats tab owns per-scorer/per-assist attribution", () => {
    renderPage("stats");
    expect(screen.getAllByText("Vetle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sindre").length).toBeGreaterThan(0);
  });

  it("never imports a report-mutation module — editing happens only in the report workspace (structural guarantee)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/dev/ui-lab/gate-b/b08-information-ownership/after/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("report-mutations");
    expect(source).not.toContain("/post-match/actions");
    expect(source).not.toContain("completeMatchReport");
  });

  it("the primary 'Continue report' action is a real link into this candidate's own REPORT-DRAFT route", () => {
    renderPage("overview");
    expect(screen.getByRole("link", { name: "Continue report" })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b08-information-ownership/report-draft",
    );
  });

  it("has no inert or fake navigation controls (no href=\"#\")", () => {
    const { container } = renderPage("overview");
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("href")).not.toBe("#");
    }
  });

  describe("?report=completed (P1-5 remediation: a completed report survives the return to Match Details)", () => {
    it("shows the completed heading/status and no 'Needs work'/'needs timing review' language", () => {
      renderPage("overview", "completed");
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("report completed");
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.queryByText("Needs work")).not.toBeInTheDocument();
      expect(screen.queryByText(/still needs timing review/)).not.toBeInTheDocument();
    });

    it("the primary action becomes 'View report', linking to REPORT-COMPLETED, not REPORT-DRAFT", () => {
      renderPage("overview", "completed");
      expect(screen.queryByRole("link", { name: "Continue report" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "View report" })).toHaveAttribute(
        "href",
        "/dev/ui-lab/gate-b/b08-information-ownership/report-completed",
      );
    });

    it("the After-match tab's own report link also resolves to REPORT-COMPLETED, not a production-shaped URL (P2-8)", () => {
      renderPage("after-match", "completed");
      // "View full report" is the After-match panel's own secondary link; the page-level primary
      // CTA shows "View report" on this tab too (both correctly point to REPORT-COMPLETED).
      expect(screen.getByRole("link", { name: "View full report" })).toHaveAttribute(
        "href",
        "/dev/ui-lab/gate-b/b08-information-ownership/report-completed",
      );
      expect(screen.getByRole("link", { name: "View report" })).toHaveAttribute(
        "href",
        "/dev/ui-lab/gate-b/b08-information-ownership/report-completed",
      );
    });

    it("the After-match tab shows the real locked status (no outstanding timing-review warning)", () => {
      renderPage("after-match", "completed");
      expect(screen.getByText(/^Locked/)).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("the default (no ?report param) is unchanged — still the draft/incomplete reference snapshot", () => {
      renderPage("overview");
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("report incomplete");
      expect(screen.getByText("Needs work")).toBeInTheDocument();
    });
  });

  describe("After-match tab's report link — draft variant (P2-8)", () => {
    it("resolves to this candidate's own REPORT-DRAFT route, not a production-shaped URL", () => {
      renderPage("after-match");
      // Both the page-level primary CTA and the After-match panel's own secondary CTA render on
      // this tab and share the accessible name "Continue report" — assert every one of them.
      const links = screen.getAllByRole("link", { name: "Continue report" });
      expect(links.length).toBeGreaterThanOrEqual(2);
      for (const link of links) {
        expect(link).toHaveAttribute("href", "/dev/ui-lab/gate-b/b08-information-ownership/report-draft");
      }
    });
  });
});
