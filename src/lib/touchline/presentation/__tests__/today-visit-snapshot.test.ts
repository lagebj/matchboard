import { describe, it, expect } from "vitest";
import {
  buildTodayVisitSnapshot,
  diffTodayVisitSnapshots,
  type TodayVisitCurrentFacts,
  type TodayVisitSnapshotV1,
} from "../today-visit-snapshot";

function baseFacts(overrides: Partial<TodayVisitCurrentFacts> = {}): TodayVisitCurrentFacts {
  return {
    liveMatchIds: [],
    matches: [],
    planSignals: [],
    rounds: [],
    ...overrides,
  };
}

describe("today-visit-snapshot", () => {
  it("produces no rows and no card on a first visit (no previous snapshot)", () => {
    const { rows, overflowCount } = diffTodayVisitSnapshots(null, baseFacts());
    expect(rows).toEqual([]);
    expect(overflowCount).toBe(0);
  });

  it("detects a match becoming newly live", () => {
    const previous = buildTodayVisitSnapshot(baseFacts(), 1_000);
    const current = baseFacts({
      liveMatchIds: ["m1"],
      matches: [{ matchId: "m1", kickoffIso: "2026-09-14T10:00:00Z", reportState: "DRAFT", label: "Rød vs Stoppen Como" }],
    });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "NEWLY_LIVE", text: "Rød vs Stoppen Como is now live" }]);
  });

  it("detects a kickoff time change", () => {
    const previous = buildTodayVisitSnapshot(
      baseFacts({ matches: [{ matchId: "m1", kickoffIso: "2026-09-14T10:00:00.000Z", reportState: "DRAFT", label: "Rød" }] }),
      1_000,
    );
    const current = baseFacts({
      matches: [{ matchId: "m1", kickoffIso: "2026-09-14T11:00:00.000Z", reportState: "DRAFT", label: "Rød" }],
    });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("KICKOFF_CHANGED");
  });

  it("detects a report completing (draft -> reported)", () => {
    const previous = buildTodayVisitSnapshot(
      baseFacts({ matches: [{ matchId: "m1", kickoffIso: null, reportState: "DRAFT", label: "Rød" }] }),
      1_000,
    );
    const current = baseFacts({ matches: [{ matchId: "m1", kickoffIso: null, reportState: "REPORTED", label: "Rød" }] });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "REPORT_LIFECYCLE", text: "Rød report submitted" }]);
  });

  it("detects a new plan-integrity signal", () => {
    const previous = buildTodayVisitSnapshot(baseFacts(), 1_000);
    const current = baseFacts({ planSignals: [{ signalKey: "sig-1", title: "Anna is available without a planned opportunity" }] });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "NEW_SIGNAL", text: "Anna is available without a planned opportunity" }]);
  });

  it("renders a resolved signal as an aggregate fact, never inventing a name", () => {
    const previous = buildTodayVisitSnapshot(baseFacts({ planSignals: [{ signalKey: "sig-1", title: "..." }] }), 1_000);
    const current = baseFacts({ planSignals: [] });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "RESOLVED_SIGNAL", text: "A round-planning decision was resolved" }]);
  });

  it("pluralizes the aggregate resolved-signal row for multiple resolutions", () => {
    const previous = buildTodayVisitSnapshot(
      baseFacts({ planSignals: [{ signalKey: "sig-1", title: "a" }, { signalKey: "sig-2", title: "b" }] }),
      1_000,
    );
    const current = baseFacts({ planSignals: [] });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "RESOLVED_SIGNAL", text: "2 round-planning decisions were resolved" }]);
  });

  it("renders round-ready only when no more specific resolved-signal row already explains it", () => {
    const previous = buildTodayVisitSnapshot(
      baseFacts({ rounds: [{ roundId: "r1", label: "W42", blocked: 1, decisions: 0 }] }),
      1_000,
    );
    const current = baseFacts({ rounds: [{ roundId: "r1", label: "W42", blocked: 0, decisions: 0 }] });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "ROUND_READY", text: "W42 is now ready" }]);
  });

  it("suppresses the round-ready row when a resolved-signal row already explains it", () => {
    const previous = buildTodayVisitSnapshot(
      baseFacts({
        planSignals: [{ signalKey: "sig-1", title: "..." }],
        rounds: [{ roundId: "r1", label: "W42", blocked: 1, decisions: 0 }],
      }),
      1_000,
    );
    const current = baseFacts({ planSignals: [], rounds: [{ roundId: "r1", label: "W42", blocked: 0, decisions: 0 }] });
    const { rows } = diffTodayVisitSnapshots(previous, current);
    expect(rows).toEqual([{ kind: "RESOLVED_SIGNAL", text: "A round-planning decision was resolved" }]);
  });

  it("caps rows at 5 and reports the overflow count", () => {
    const previous: TodayVisitSnapshotV1 = {
      version: 1,
      seenAtMs: 0,
      liveMatchIds: [],
      matchKickoffById: {},
      reportStateByMatchId: {},
      planSignalKeys: [],
      roundReadinessById: {},
    };
    const current = baseFacts({
      planSignals: Array.from({ length: 8 }, (_, i) => ({ signalKey: `sig-${i}`, title: `Signal ${i}` })),
    });
    const { rows, overflowCount } = diffTodayVisitSnapshots(previous, current);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(overflowCount).toBe(3);
  });

  it("round-trips through build -> diff with no changes producing no rows", () => {
    const facts = baseFacts({
      liveMatchIds: ["m1"],
      matches: [{ matchId: "m1", kickoffIso: "2026-09-14T10:00:00Z", reportState: "DRAFT", label: "Rød" }],
    });
    const previous = buildTodayVisitSnapshot(facts, 1_000);
    const { rows } = diffTodayVisitSnapshots(previous, facts);
    expect(rows).toEqual([]);
  });
});
