import { describe, it, expect } from "vitest";
import { plannedMatchIdentity, liveMatchIdentity, completedMatchIdentity } from "../fixtures";

/**
 * A02 data-truth invariants (`20_UI_LAB_CANDIDATE_WAVES.md` A02; `05_DATA_AND_VISUALIZATION_
 * TRUTH.md` D5). Locks in that the Gate A match-lifecycle candidate never fabricates facts and
 * never loses the match's identity across lifecycle states.
 */
describe("A02 match-lifecycle candidate fixture", () => {
  it("keeps one match identity (id, teams, own-team side) across all three lifecycle states", () => {
    const states = [plannedMatchIdentity, liveMatchIdentity, completedMatchIdentity];
    for (const state of states) {
      expect(state.id).toBe("gate-a-match-1");
      expect(state.homeTeam).toBe("Rød");
      expect(state.awayTeam).toBe("Sætre Lions");
      expect(state.ownTeamSide).toBe("home");
    }
  });

  it("never shows a fabricated score before kickoff", () => {
    expect(plannedMatchIdentity.score).toBeNull();
    expect(plannedMatchIdentity.lifecycle).not.toBe("live");
    expect(plannedMatchIdentity.lifecycle).not.toBe("done");
  });

  it("shows a provable in-progress score and clock while live", () => {
    expect(liveMatchIdentity.score).toEqual({ home: 2, away: 1 });
    expect(liveMatchIdentity.clockLabel).toBe("37′");
    expect(liveMatchIdentity.lifecycle).toBe("live");
  });

  it("shows the canonical final result once completed, independent of any single timeline's logged event count", () => {
    expect(completedMatchIdentity.score).toEqual({ home: 6, away: 4 });
    expect(completedMatchIdentity.resultOutcomeForOwnTeam).toBe("win");
    expect(completedMatchIdentity.lifecycle).toBe("done");
  });
});
