import { describe, it, expect } from "vitest";
import type { AssistantWorkItem } from "@/lib/assistant/types";
import {
  assistantWorkItemsToCandidates,
  ASSISTANT_CANDIDATE_PROVIDER_ID,
} from "../providers/assistant-candidate-provider";

function makeItem(overrides: Partial<AssistantWorkItem> & Pick<AssistantWorkItem, "category">): AssistantWorkItem {
  return {
    id: `${overrides.category}|round-1`,
    priority: 0,
    title: "Title",
    summary: "Summary",
    matchRoundId: "round-1",
    affectedTeamIds: [],
    affectedPlayerIds: [],
    primaryActionLabel: "Do it",
    primaryActionHref: "/fixtures",
    ...overrides,
  };
}

describe("assistantWorkItemsToCandidates", () => {
  it("excludes upcoming_round items (informational, never a decision candidate)", () => {
    const items = [makeItem({ category: "upcoming_round" })];
    expect(assistantWorkItemsToCandidates(items, () => undefined)).toHaveLength(0);
  });

  it("maps a blocked_round item to a hard-consequence candidate with the item's action as the recommendation", () => {
    const items = [
      makeItem({
        category: "blocked_round",
        matchId: "match-1",
        blockedCount: 2,
        title: "Round blocked",
        primaryActionLabel: "Review round",
        primaryActionHref: "/rounds/round-1",
      }),
    ];
    const [candidate] = assistantWorkItemsToCandidates(items, () => "2026-01-01T12:00:00.000Z");

    expect(candidate.source).toBe(ASSISTANT_CANDIDATE_PROVIDER_ID);
    expect(candidate.consequences).toContain("SQUAD_DEGRADED");
    expect(candidate.consequences).toContain("PLANNING_BLOCKED");
    expect(candidate.entityType).toBe("MATCH");
    expect(candidate.entityId).toBe("match-1");
    expect(candidate.recommendedAction).toEqual({ label: "Review round", href: "/rounds/round-1" });
    expect(candidate.deadlineAt).toBe("2026-01-01T12:00:00.000Z");
    expect(candidate.facts).toContainEqual({ code: "BLOCKED_COUNT", numericValue: 2 });
  });

  it("marks pending_profile_suggestions as a long-term signal", () => {
    const items = [makeItem({ category: "pending_profile_suggestions" })];
    const [candidate] = assistantWorkItemsToCandidates(items, () => undefined);
    expect(candidate.isLongTermSignal).toBe(true);
  });

  it("does not mark operational categories as long-term signals", () => {
    const items = [makeItem({ category: "blocked_round" })];
    const [candidate] = assistantWorkItemsToCandidates(items, () => undefined);
    expect(candidate.isLongTermSignal).toBe(false);
  });

  it("falls back to INFORMATION_ONLY for an unmapped-in-practice category (defensive)", () => {
    const items = [makeItem({ category: "ready_to_finalize" })];
    const [candidate] = assistantWorkItemsToCandidates(items, () => undefined);
    expect(candidate.consequences).toEqual(["INFORMATION_ONLY"]);
  });

  it("derives entityId from eventId when present, else matchId, else matchRoundId", () => {
    const withEvent = assistantWorkItemsToCandidates(
      [makeItem({ category: "event_squads_missing", eventId: "event-1", matchRoundId: "round-1" })],
      () => undefined,
    )[0];
    expect(withEvent.entityType).toBe("EVENT");
    expect(withEvent.entityId).toBe("event-1");

    const withRoundOnly = assistantWorkItemsToCandidates(
      [makeItem({ category: "setup_missing", matchRoundId: "round-2" })],
      () => undefined,
    )[0];
    expect(withRoundOnly.entityType).toBe("ROUND");
    expect(withRoundOnly.entityId).toBe("round-2");
  });

  it("uses the match-deadline lookup keyed by the item's matchId", () => {
    const items = [makeItem({ category: "blocked_round", matchId: "match-7" })];
    const lookup = (matchId: string | undefined) => (matchId === "match-7" ? "2026-02-02T00:00:00.000Z" : undefined);
    const [candidate] = assistantWorkItemsToCandidates(items, lookup);
    expect(candidate.deadlineAt).toBe("2026-02-02T00:00:00.000Z");
  });

  it("excludes explicitly excluded categories (e.g. when a richer provider already covers them)", () => {
    const items = [
      makeItem({ category: "blocked_round" }),
      makeItem({ category: "decision_required" }),
      makeItem({ category: "setup_missing" }),
    ];
    const candidates = assistantWorkItemsToCandidates(items, () => undefined, ["blocked_round", "decision_required"]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].source).toBe(ASSISTANT_CANDIDATE_PROVIDER_ID);
  });

  it("with no excludeCategories argument, still covers blocked_round/decision_required (backward-compatible default)", () => {
    const items = [makeItem({ category: "blocked_round" }), makeItem({ category: "decision_required" })];
    expect(assistantWorkItemsToCandidates(items, () => undefined)).toHaveLength(2);
  });
});
