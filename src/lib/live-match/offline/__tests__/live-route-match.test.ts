import { describe, it, expect } from "vitest";
import { isLiveRoute, extractLiveRouteSubjectId } from "../live-route-match";

describe("isLiveRoute / extractLiveRouteSubjectId (ADR-0138 Bundle 7)", () => {
  it("matches a League match live route, with or without an org prefix", () => {
    expect(isLiveRoute("/matches/abc123/live")).toBe(true);
    expect(isLiveRoute("/o/test-club-a/matches/abc123/live")).toBe(true);
    expect(extractLiveRouteSubjectId("/o/test-club-a/matches/abc123/live")).toBe("abc123");
  });

  it("matches an Event match live route nested under /events/", () => {
    expect(isLiveRoute("/o/test-club-a/events/evt1/matches/abc123/live")).toBe(true);
    expect(extractLiveRouteSubjectId("/o/test-club-a/events/evt1/matches/abc123/live")).toBe("abc123");
  });

  it("tolerates a trailing slash", () => {
    expect(isLiveRoute("/o/test-club-a/matches/abc123/live/")).toBe(true);
    expect(extractLiveRouteSubjectId("/o/test-club-a/matches/abc123/live/")).toBe("abc123");
  });

  it("does not match the read-only Follow Live route", () => {
    expect(isLiveRoute("/o/test-club-a/matches/abc123/live/follow")).toBe(false);
  });

  it("does not match a match detail page or the create-match route", () => {
    expect(isLiveRoute("/o/test-club-a/matches/abc123")).toBe(false);
    expect(isLiveRoute("/o/test-club-a/matches/new")).toBe(false);
  });

  it("returns null for a non-matching pathname", () => {
    expect(extractLiveRouteSubjectId("/today")).toBeNull();
  });
});
