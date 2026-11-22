import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerPicker } from "../player-picker";
import type { PlayerMatchPositionUsage } from "@/lib/player-development/position-usage-history";

// C06-B (Gate C W2 remediation — PR #829): real completed-match positional evidence shown
// alongside the existing declared-fit tier in the Lineup editor's player picker — the actual
// assignment-decision point. Evidence is purely additive display information; it must never
// change which tier a candidate is classified into or how the list is sorted (ADR-0129 §5's own
// invariant: "no parameter for fairness, evidence... by construction, none of those can create
// or upgrade positional eligibility").

const slot = {
  id: "slot-1",
  gridX: 2,
  gridY: 2,
  label: "Centre Midfield",
  shortLabel: "CM",
  roleType: "MIDFIELDER" as const,
  acceptedPositionIds: ["CM"],
  sortOrder: 1,
};

function usage(matchKey: string, playedAt: string, minutesByPosition: Record<string, number>): PlayerMatchPositionUsage {
  return { matchKey, source: "LEAGUE_MATCH", playedAt: new Date(playedAt), minutesByPosition, startedAtKickoff: true };
}

describe("PlayerPicker — real completed-match evidence (C06-B)", () => {
  it("shows a candidate's real evidence at the slot's exact target position", () => {
    render(
      <PlayerPicker
        isOpen
        onClose={() => {}}
        players={[{ id: "p1", firstName: "Erik", lastName: "Berg", primaryPosition: "CM" }]}
        slot={slot}
        assignedPlayerIds={new Set()}
        onSelect={() => {}}
        onClear={() => {}}
        evidenceByPlayerId={{
          p1: [usage("m1", "2026-01-01", { CM: 60 }), usage("m2", "2026-01-08", { CM: 45 })],
        }}
      />,
    );

    expect(screen.getByText("Played here in 2 matches (105 min)")).toBeInTheDocument();
  });

  it("explicitly shows 'no match record' for a candidate with limited/missing evidence at this position, rather than staying silent", () => {
    render(
      <PlayerPicker
        isOpen
        onClose={() => {}}
        players={[{ id: "p1", firstName: "Erik", lastName: "Berg", primaryPosition: "CM" }]}
        slot={slot}
        assignedPlayerIds={new Set()}
        onSelect={() => {}}
        onClear={() => {}}
        evidenceByPlayerId={{ p1: [usage("m1", "2026-01-01", { CB: 90 })] }}
      />,
    );

    expect(screen.getByText("No match record at this position")).toBeInTheDocument();
  });

  it("renders no evidence line at all when evidenceByPlayerId is not supplied (backward compatible with every existing caller)", () => {
    render(
      <PlayerPicker
        isOpen
        onClose={() => {}}
        players={[{ id: "p1", firstName: "Erik", lastName: "Berg", primaryPosition: "CM" }]}
        slot={slot}
        assignedPlayerIds={new Set()}
        onSelect={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.queryByText(/match record|Played here/)).toBeNull();
  });

  it("shows the real difference between a declared position and evidence-derived history: a player declared CB with real CM minutes shows the declared-fit tier (from the declaration alone) AND the real CM evidence side by side, never blended into one score", () => {
    render(
      <PlayerPicker
        isOpen
        onClose={() => {}}
        players={[{ id: "p1", firstName: "Erik", lastName: "Berg", primaryPosition: "CB" }]}
        slot={slot}
        assignedPlayerIds={new Set()}
        onSelect={() => {}}
        onClear={() => {}}
        evidenceByPlayerId={{ p1: [usage("m1", "2026-01-01", { CM: 90 })] }}
      />,
    );

    // Declared-fit tier (CB -> CM) is computed purely from the declaration, unaffected by the
    // real CM evidence below it — both facts are shown, never merged into a single number.
    expect(screen.getByText("Plausible fit")).toBeInTheDocument();
    expect(screen.getByText("Played here in 1 match (90 min)")).toBeInTheDocument();
  });

  it("never changes sort order based on evidence — tier rank (declared fit) remains the only sort key", () => {
    render(
      <PlayerPicker
        isOpen
        onClose={() => {}}
        players={[
          { id: "p1", firstName: "Alice", lastName: null, primaryPosition: "ST" }, // UNSUPPORTED for CM, but lots of CM evidence.
          { id: "p2", firstName: "Bob", lastName: null, primaryPosition: "CM" }, // NATURAL for CM, no evidence at all.
        ]}
        slot={slot}
        assignedPlayerIds={new Set()}
        onSelect={() => {}}
        onClear={() => {}}
        evidenceByPlayerId={{
          p1: [usage("m1", "2026-01-01", { CM: 900 })],
        }}
      />,
    );

    const names = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    const bobIndex = names.findIndex((t) => t.includes("Bob"));
    const aliceIndex = names.findIndex((t) => t.includes("Alice"));
    // Bob (NATURAL declared fit) must still sort before Alice (UNSUPPORTED declared fit),
    // even though Alice has overwhelming real evidence at this exact position.
    expect(bobIndex).toBeGreaterThanOrEqual(0);
    expect(aliceIndex).toBeGreaterThan(bobIndex);
  });
});
