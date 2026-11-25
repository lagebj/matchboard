import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D01AgreeingPositionsPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D01AgreeingPositionsPage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 — D01 agreeing positions", () => {
  it("renders the current-story headline", () => {
    renderPage();
    expect(screen.getByText("Current story")).toBeInTheDocument();
    expect(screen.getByText(/Recent opportunities have been consistent: 5 of 5 eligible rounds\./)).toBeInTheDocument();
  });

  it("renders both the evidence-derived position map and the declared-position map, each the real pitch component", () => {
    renderPage();
    // One from PlayerPositionMapWidget (effective positions), one from PlayerPositionProfile
    // (declared positions) — both the same canonical TouchlinePositionMap renderer.
    expect(screen.getAllByTestId("touchline-position-map")).toHaveLength(2);
    expect(screen.getByText("Effective position profile")).toBeInTheDocument();
  });

  it("declared and evidence-derived positions share one label vocabulary — never a second, conflicting code system for the same position", () => {
    renderPage();
    // Declared (Manage-tab style) rendering, via the real PlayerPositionProfile.
    expect(screen.getByText("Centre Back (CB)")).toBeInTheDocument();
    // Evidence-derived (Overview-tab style) rendering, via the real PlayerPositionMapWidget list.
    const effectiveListLabels = screen.getAllByText("Centre Back");
    expect(effectiveListLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("distinguishes declaration from evidence by provenance/support-band, not by a separate code system", () => {
    renderPage();
    expect(screen.getByText("Declared positions")).toBeInTheDocument();
    expect(screen.getByText(/Coach declaration\. The Overview tab shows how declared positions and recorded match evidence combine\./)).toBeInTheDocument();
  });

  it("discloses that the position editor is simulated", () => {
    renderPage();
    expect(screen.getByText(/simulated: no Server Action is called/i)).toBeInTheDocument();
  });

  it("demonstrates the approved 14-role profile experience (ADR-0160 §6), with declared and evidence-derived profile roles agreeing", () => {
    renderPage();
    expect(screen.getByText("Player-profile role (directional)")).toBeInTheDocument();
    expect(screen.getByText("Declared and evidence-derived profile roles agree.")).toBeInTheDocument();
    // Declared "CB" and derived "CB" both appear as profile-level labels, distinct from the
    // real production mount's exact-code rendering above.
    expect(screen.getByText(/Declared:/).closest("span")).toHaveTextContent("CB");
    expect(screen.getByText(/Evidence-derived:/).closest("span")).toHaveTextContent("CB");
  });

  it("keeps the exact tactical evidence accessible via drill-down, not merged away", () => {
    renderPage();
    const details = screen.getByText("Exact tactical evidence").closest("details");
    expect(details).not.toBeNull();
    expect(details).toHaveTextContent("RCB");
    expect(details).toHaveTextContent("CDM");
  });
});
