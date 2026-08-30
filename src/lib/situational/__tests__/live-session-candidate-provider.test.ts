import { describe, it, expect } from "vitest";
import type { AssistantCommandCentre, TodayMatch } from "@/lib/assistant/types";
import {
  createLiveSessionCandidateProvider,
  staleLiveSessionsToCandidates,
  matchIdFromCandidateId,
  LIVE_SESSION_CANDIDATE_PROVIDER_ID,
  STALE_HEARTBEAT_MINUTES,
} from "../providers/live-session-candidate-provider";
import type { SituationContext } from "../situation-types";

const NOW = "2026-01-01T12:00:00.000Z";

const DUMMY_CONTEXT: SituationContext = {
  nowIso: NOW,
  primarySituation: "MATCHDAY",
  imminentMatchIds: [],
  temporal: {},
};

function minutesAgoIso(minutes: number): string {
  return new Date(new Date(NOW).getTime() - minutes * 60_000).toISOString();
}

function makeTodayMatch(overrides: Partial<TodayMatch> = {}): TodayMatch {
  return {
    matchId: "match-1",
    matchRoundId: "round-1",
    matchRoundName: "Round 7",
    teamName: "Blue",
    opponent: "Red FC",
    homeAway: "HOME",
    startsAt: NOW,
    squadStatus: "finalized",
    hasActiveLiveSession: true,
    reportStatus: null,
    lifecycleStatus: "live",
    ...overrides,
  };
}

describe("staleLiveSessionsToCandidates", () => {
  it("produces no candidate for a session with a recent heartbeat", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(30), lastHeartbeatAt: minutesAgoIso(1) },
    };
    const candidates = staleLiveSessionsToCandidates(activeLiveSessions, [makeTodayMatch()], NOW);
    expect(candidates).toHaveLength(0);
  });

  it("produces a candidate when the last heartbeat exceeds the stale threshold", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(60), lastHeartbeatAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES + 1) },
    };
    const candidates = staleLiveSessionsToCandidates(activeLiveSessions, [makeTodayMatch()], NOW);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe(`${LIVE_SESSION_CANDIDATE_PROVIDER_ID}|match-1`);
    expect(candidates[0].consequences).toEqual(["REPORTING_DEBT"]);
    expect(candidates[0].affectedMatchIds).toEqual(["match-1"]);
    expect(candidates[0].title).toContain("Blue");
    expect(candidates[0].title).toContain("Red FC");
    expect(candidates[0].recommendedAction).toEqual({ label: "Open live match", href: "/matches/match-1/live" });
  });

  it("produces a candidate exactly at the threshold boundary (inclusive: >= STALE_HEARTBEAT_MINUTES counts as stale)", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(60), lastHeartbeatAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES) },
    };
    const candidates = staleLiveSessionsToCandidates(activeLiveSessions, [makeTodayMatch()], NOW);
    expect(candidates).toHaveLength(1);
  });

  it("falls back to startedAt when lastHeartbeatAt is null (no heartbeat sent yet)", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES + 5), lastHeartbeatAt: null },
    };
    const candidates = staleLiveSessionsToCandidates(activeLiveSessions, [makeTodayMatch()], NOW);
    expect(candidates).toHaveLength(1);
  });

  it("does not flag a freshly started session with no heartbeat yet", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(1), lastHeartbeatAt: null },
    };
    const candidates = staleLiveSessionsToCandidates(activeLiveSessions, [makeTodayMatch()], NOW);
    expect(candidates).toHaveLength(0);
  });

  it("falls back to a generic title when no matching TodayMatch is found", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-unknown": { startedAt: minutesAgoIso(60), lastHeartbeatAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES + 1) },
    };
    const candidates = staleLiveSessionsToCandidates(activeLiveSessions, [], NOW);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe("Live session stalled");
  });

  it("handles multiple simultaneously stalled sessions", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(60), lastHeartbeatAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES + 1) },
      "match-2": { startedAt: minutesAgoIso(60), lastHeartbeatAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES + 20) },
    };
    const candidates = staleLiveSessionsToCandidates(
      activeLiveSessions,
      [makeTodayMatch(), makeTodayMatch({ matchId: "match-2", teamName: "Green" })],
      NOW,
    );
    expect(candidates).toHaveLength(2);
  });
});

describe("matchIdFromCandidateId", () => {
  it("recovers the original matchId", () => {
    expect(matchIdFromCandidateId(`${LIVE_SESSION_CANDIDATE_PROVIDER_ID}|match-1`)).toBe("match-1");
  });

  it("returns null for an id from a different provider", () => {
    expect(matchIdFromCandidateId("other-provider|match-1")).toBeNull();
  });
});

describe("createLiveSessionCandidateProvider", () => {
  it("exposes the provider id and produces candidates without recomputation", () => {
    const activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {
      "match-1": { startedAt: minutesAgoIso(60), lastHeartbeatAt: minutesAgoIso(STALE_HEARTBEAT_MINUTES + 1) },
    };
    const provider = createLiveSessionCandidateProvider(activeLiveSessions, [makeTodayMatch()], NOW);
    expect(provider.id).toBe(LIVE_SESSION_CANDIDATE_PROVIDER_ID);
    expect(provider.getCandidates(DUMMY_CONTEXT)).toHaveLength(1);
  });

  it("returns an empty list when there are no active sessions", () => {
    const provider = createLiveSessionCandidateProvider({}, [], NOW);
    expect(provider.getCandidates(DUMMY_CONTEXT)).toHaveLength(0);
  });
});
