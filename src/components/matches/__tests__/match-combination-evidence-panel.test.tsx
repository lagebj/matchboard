import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCombinationEvidencePanel } from "../match-combination-evidence-panel";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";

const PLAYERS = [
  { id: "p1", name: "Alice" },
  { id: "p2", name: "Bob" },
  { id: "p3", name: "Cara" },
];

function makeRow(overrides: Partial<CombinationEvidenceRow> & { playerIds: string[] }): CombinationEvidenceRow {
  return {
    id: `row-${Math.random().toString(36).slice(2, 8)}`,
    organisationId: "org-1",
    matchId: "match-1",
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    positions: [],
    minutesTogether: 45,
    goalsForWhilePresent: 0,
    goalsAgainstWhilePresent: 0,
    directGoalContributions: 0,
    directAssistContributions: 0,
    opponentDiversity: 1,
    confidence: "EMERGING",
    approximateTiming: false,
    leagueSeasonId: "ls-1",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("MatchCombinationEvidencePanel", () => {
  it("renders nothing when there is no qualifying evidence", () => {
    const { container } = render(<MatchCombinationEvidencePanel evidence={[]} players={PLAYERS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("filters out combinations under the minimum minutes threshold", () => {
    const { container } = render(
      <MatchCombinationEvidencePanel evidence={[makeRow({ playerIds: ["p1", "p2"], minutesTogether: 3 })]} players={PLAYERS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("filters out FUNCTIONAL_UNIT and FULL_CONFIGURATION rows, keeping PARTNERSHIP/TRIANGLE", () => {
    render(
      <MatchCombinationEvidencePanel
        evidence={[
          makeRow({ playerIds: ["p1", "p2"], family: "PARTNERSHIP", minutesTogether: 40 }),
          makeRow({ playerIds: ["p1", "p2", "p3"], family: "FULL_CONFIGURATION", subtype: null, minutesTogether: 60 }),
        ]}
        players={PLAYERS}
      />,
    );
    expect(screen.getByText(/Alice \+ Bob/)).toBeTruthy();
    expect(screen.queryByText(/Alice \+ Bob \+ Cara/)).toBeNull();
  });

  it("shows minutes and outcome facts, with no score or percentage", () => {
    render(
      <MatchCombinationEvidencePanel
        evidence={[
          makeRow({
            playerIds: ["p1", "p2"],
            minutesTogether: 62,
            goalsForWhilePresent: 2,
            goalsAgainstWhilePresent: 1,
            directGoalContributions: 1,
          }),
        ]}
        players={PLAYERS}
      />,
    );
    expect(screen.getByText(/62 min this match/)).toBeTruthy();
    expect(screen.getByText(/team scored 2 while present/)).toBeTruthy();
    expect(screen.getByText(/team conceded 1 while present/)).toBeTruthy();
    expect(screen.getByText(/1 direct goal contribution/)).toBeTruthy();
    expect(screen.queryByText(/%|\/10|synergy|chemistry/i)).toBeNull();
  });

  it("sorts by minutes together descending and caps the number of rows shown", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({ playerIds: [`p1`, `p2`], minutesTogether: 10 + i, subtype: `SUB_${i}` as never }),
    );
    const { container } = render(<MatchCombinationEvidencePanel evidence={rows} players={PLAYERS} />);
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(8);
  });
});
