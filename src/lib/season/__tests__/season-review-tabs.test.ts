import { describe, it, expect } from "vitest";
import { getSeasonReviewTabs, getSeasonReviewDefaultTab, resolveSeasonReviewTab } from "../season-review-tabs";

describe("season-review-tabs", () => {
  it("exposes the five spec-required local tabs in order", () => {
    expect(getSeasonReviewTabs().map((t) => t.key)).toEqual(["overview", "teams", "players", "development", "opportunity"]);
  });

  it("defaults to Overview", () => {
    expect(getSeasonReviewDefaultTab()).toBe("overview");
  });

  it("resolves a valid tab key", () => {
    expect(resolveSeasonReviewTab("development")).toBe("development");
  });

  it("falls back to Overview for an unknown or missing tab", () => {
    expect(resolveSeasonReviewTab("not-a-tab")).toBe("overview");
    expect(resolveSeasonReviewTab(null)).toBe("overview");
    expect(resolveSeasonReviewTab(undefined)).toBe("overview");
  });
});
