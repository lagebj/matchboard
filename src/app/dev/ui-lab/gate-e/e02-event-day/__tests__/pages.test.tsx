import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const PATH = "/dev/ui-lab/gate-e/e02-event-day/mixed-progression";
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), path: "" }));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => nav.params,
}));

const { default: MixedPage } = await import("../mixed-progression/page");
const { default: UpcomingPage } = await import("../upcoming/page");
const { default: CompletedPage } = await import("../completed/page");

function renderWith(Page: () => React.ReactElement, path: string, query = "") {
  nav.path = path;
  nav.params = new URLSearchParams(query);
  return render(
    <ThemeProvider>
      <Page />
    </ThemeProvider>,
  );
}
const row = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`[data-e02-match-row="${id}"]`)!;

beforeEach(() => routerPush.mockClear());

describe("E02 MIXED — event identity and progression", () => {
  it("the Event heading is the page's only h1 with the production context line", () => {
    renderWith(MixedPage, PATH);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Fjellsiden Vårcup"]);
    expect(screen.getByText("Tournament · 7-a-side · Saturday 13 March 2027 · Draft")).toBeInTheDocument();
  });

  it("renders all nine matches in the real timeline with state kickers in text", () => {
    renderWith(MixedPage, PATH);
    const list = screen.getByRole("list", { name: "Event-day match timeline" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
    for (const k of ["CANCELLED", "REPORT MISSING", "REPORT DRAFT", "LATER"]) expect(within(list).getByText(k)).toBeInTheDocument();
    // "LIVE" appears as the timeline kicker AND inside the real ScorebookMatchRow's live trailer.
    expect(within(list).getAllByText(/^LIVE/)).toHaveLength(2);
    expect(within(list).getAllByText("NEXT")).toHaveLength(2);
    expect(screen.getByTestId("e02-day-summary")).toHaveTextContent("9 matches in kickoff order · 2 results · 1 live · 2 need report follow-up · 3 to come · 1 cancelled");
  });

  it("each row names its own squad; the cancelled row shows its recorded reason", () => {
    const { container } = renderWith(MixedPage, PATH);
    expect(row(container, "gate-e-w2-e02-m05")).toHaveTextContent("Fjellsiden Rød");
    expect(row(container, "gate-e-w2-e02-m05")).not.toHaveTextContent("Fjellsiden Blå");
    expect(row(container, "gate-e-w2-e02-m01")).toHaveTextContent("Fjellsiden Blå");
    expect(row(container, "gate-e-w2-e02-m03")).toHaveTextContent("Sjøvik SK withdrew before kickoff");
  });

  it("the DRAFT row never shows its draft score; the draft caption says it is not final", () => {
    const { container } = renderWith(MixedPage, PATH);
    const draft = row(container, "gate-e-w2-e02-m05");
    expect(draft).toHaveTextContent("Draft report — score not final");
    expect(draft.textContent).not.toMatch(/Win|Loss|Draw/);
  });

  it("row links select the match in this view and preserve existing query values (theme)", () => {
    const { container } = renderWith(MixedPage, PATH, "theme=dark");
    const link = row(container, "gate-e-w2-e02-m05").querySelector("a")!;
    const url = new URL(link.getAttribute("href")!, "http://x");
    expect(url.pathname).toBe(PATH);
    expect(url.searchParams.get("match")).toBe("gate-e-w2-e02-m05");
    expect(url.searchParams.get("theme")).toBe("dark");
  });

  it("no rendered link points at an invented Event Match Detail route", () => {
    const { container } = renderWith(MixedPage, PATH, "match=gate-e-w2-e02-m06");
    const allowed = [
      /^\/dev\/ui-lab\//,
      /^\/events$/,
      /^\/o\/acme\/events\/gate-e-w2-e02-event\/matches\/gate-e-w2-e02-m\d\d\/live(\/follow)?$/,
      /^\/o\/acme\/events\/gate-e-w2-e02-event\?tab=matches$/,
    ];
    for (const a of container.querySelectorAll("a")) {
      const href = a.getAttribute("href")!;
      expect(allowed.some((r) => r.test(href)), href).toBe(true);
    }
  });
});

describe("E02 MIXED — selected-match context", () => {
  it("a directly-loaded `match` restores that exact match and squad; the Event heading is unchanged", () => {
    const { container } = renderWith(MixedPage, PATH, "match=gate-e-w2-e02-m05");
    const panel = container.querySelector<HTMLElement>("[data-e02-selected-match]")!;
    expect(panel.getAttribute("data-e02-selected-match")).toBe("gate-e-w2-e02-m05");
    expect(within(panel).getByTestId("e02-selected-squad")).toHaveTextContent("Fjellsiden Rød");
    expect(within(panel).getByTestId("e02-selected-kickoff")).toHaveTextContent("SAT 13 MAR · 10:20");
    expect(within(panel).getByTestId("e02-selected-report")).toHaveTextContent("Draft — not final, no result shown");
    expect(panel.textContent).not.toMatch(/1–0|1-0/);
    expect(within(panel).getByText("Fjellsiden Vårcup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fjellsiden Vårcup");
    expect(row(container, "gate-e-w2-e02-m05")).toHaveTextContent("Selected");
    expect(row(container, "gate-e-w2-e02-m01")).not.toHaveTextContent("Selected");
  });

  it("the live match offers the canonical live-reporting entry label and real route", () => {
    renderWith(MixedPage, PATH, "match=gate-e-w2-e02-m06");
    const link = screen.getByRole("link", { name: "Continue live reporting" });
    expect(link).toHaveAttribute("href", "/o/acme/events/gate-e-w2-e02-event/matches/gate-e-w2-e02-m06/live");
  });

  it("a cancelled match offers no live-reporting or follow-live entry", () => {
    const { container } = renderWith(MixedPage, PATH, "match=gate-e-w2-e02-m03");
    const panel = container.querySelector<HTMLElement>("[data-e02-selected-match]")!;
    expect(within(panel).queryByRole("link", { name: /live/i })).toBeNull();
    expect(screen.getByText("Sjøvik SK withdrew before kickoff", { selector: "dd" })).toBeInTheDocument();
  });

  it("a LOCKED match offers no live-reporting entry (production's own rule)", () => {
    const { container } = renderWith(MixedPage, PATH, "match=gate-e-w2-e02-m01");
    const panel = container.querySelector<HTMLElement>("[data-e02-selected-match]")!;
    expect(within(panel).queryByRole("link", { name: /live reporting/i })).toBeNull();
    expect(within(panel).getByRole("link", { name: "Follow live" })).toBeInTheDocument();
  });

  it("'Back to event day' clears only the match selection", () => {
    renderWith(MixedPage, PATH, "theme=dark&match=gate-e-w2-e02-m05");
    fireEvent.click(screen.getByRole("button", { name: "Back to event day" }));
    expect(routerPush).toHaveBeenCalledWith(`${PATH}?theme=dark`, { scroll: false });
  });

  it("a match id from another Event is reported, not selected", () => {
    const { container } = renderWith(MixedPage, PATH, "match=gate-e-w2-e02-other-event-m01");
    expect(container.querySelector("[data-e02-selected-match]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("belongs to Fjellsiden Vårcup");
  });

  it("switching tab keeps the Event heading and the URL-backed selection", () => {
    renderWith(MixedPage, PATH, "match=gate-e-w2-e02-m05");
    fireEvent.click(screen.getByRole("button", { name: "Matches" }));
    expect(routerPush).toHaveBeenCalledWith(`${PATH}?match=gate-e-w2-e02-m05&tab=matches`, { scroll: false });
  });

  it("a non-overview tab states it is not reproduced and keeps the Event heading", () => {
    renderWith(MixedPage, PATH, "tab=matches");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fjellsiden Vårcup");
    expect(screen.getByRole("status")).toHaveTextContent("not reproduced in this E02 candidate");
    expect(screen.queryByRole("list", { name: "Event-day match timeline" })).toBeNull();
  });
});

describe("E02 UPCOMING", () => {
  it("both 09:00 matches NEXT, no result anywhere, no FT marker", () => {
    renderWith(UpcomingPage, "/dev/ui-lab/gate-e/e02-event-day/upcoming");
    const list = screen.getByRole("list", { name: "Event-day match timeline" });
    expect(within(list).getAllByText("NEXT")).toHaveLength(2);
    expect(list.textContent).not.toMatch(/\bFT\b/);
    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
  });

  it("E02-R4: each match item is exactly one link containing the row and identity line, with no nested interactive element", () => {
    const { container } = renderWith(UpcomingPage, "/dev/ui-lab/gate-e/e02-event-day/upcoming");
    for (const r of container.querySelectorAll<HTMLElement>("[data-e02-match-row]")) {
      const links = r.querySelectorAll("a");
      expect(links).toHaveLength(1);
      const link = links[0];
      expect(link.querySelector("[data-e02-identity-line]")).not.toBeNull();
      expect(link.querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
      expect(new URL(link.getAttribute("href")!, "http://x").searchParams.get("match")).toBe(r.getAttribute("data-e02-match-row"));
    }
  });

  it("every row carries a full squad + opponent identity line (narrow-width fallback)", () => {
    const { container } = renderWith(UpcomingPage, "/dev/ui-lab/gate-e/e02-event-day/upcoming");
    expect(row(container, "gate-e-w2-e02-m02").querySelector("[data-e02-identity-line]")).toHaveTextContent("Fjellsiden Rød v Kvisten IL");
    expect(container.querySelectorAll("[data-e02-identity-line]")).toHaveLength(9);
  });
});

describe("E02 COMPLETED", () => {
  it("Event finalisation is shown as Event status, separate from per-match report state", () => {
    const { container } = renderWith(CompletedPage, "/dev/ui-lab/gate-e/e02-event-day/completed");
    expect(screen.getByText("Event is finalised")).toBeInTheDocument();
    expect(screen.getByTestId("e02-event-status")).toHaveTextContent("Finalised");
    expect(row(container, "gate-e-w2-e02-m07")).toHaveTextContent("Result reported · report not locked");
    const list = screen.getByRole("list", { name: "Event-day match timeline" });
    expect(within(list).queryByText("NEXT")).toBeNull();
    expect(within(list).queryByText("LIVE")).toBeNull();
    expect(within(list).queryByText(/REPORT/)).toBeNull();
    expect(within(list).getAllByText("CANCELLED")).toHaveLength(1);
  });
});
