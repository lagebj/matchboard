import { describe, it, expect } from "vitest";
import type { SeasonSimulationRequest, SimulationScope, SimulationPolicyMode } from "../simulation-types";

describe("Simulation types", () => {
  it("accepts valid league period remainder request", () => {
    const request: SeasonSimulationRequest = {
      scope: "league_period_remainder",
      includeLeague: true,
      includeEvents: false,
      includeCommittedPlans: true,
      includeDraftPlans: true,
      policyMode: "default_only",
    };

    expect(request.scope).toBe("league_period_remainder");
    expect(request.includeLeague).toBe(true);
    expect(request.policyMode).toBe("default_only");
  });

  it("accepts valid event simulation request", () => {
    const request: SeasonSimulationRequest = {
      scope: "event",
      includeLeague: false,
      includeEvents: true,
      includeCommittedPlans: true,
      includeDraftPlans: true,
      policyMode: "default_plus_rego",
      eventIds: ["event_1"],
    };

    expect(request.scope).toBe("event");
    expect(request.includeEvents).toBe(true);
    expect(request.policyMode).toBe("default_plus_rego");
  });

  it("accepts combined date range request", () => {
    const request: SeasonSimulationRequest = {
      scope: "combined_date_range",
      includeLeague: true,
      includeEvents: true,
      includeCommittedPlans: true,
      includeDraftPlans: true,
      policyMode: "default_only",
      dateFrom: "2026-04-01",
      dateTo: "2026-06-30",
    };

    expect(request.scope).toBe("combined_date_range");
    expect(request.dateFrom).toBe("2026-04-01");
    expect(request.dateTo).toBe("2026-06-30");
  });

  it("all scope values are valid", () => {
    const scopes: SimulationScope[] = [
      "league_round",
      "league_date_range",
      "league_period_remainder",
      "event",
      "combined_date_range",
    ];

    expect(scopes).toHaveLength(5);
  });

  it("all policy mode values are valid", () => {
    const modes: SimulationPolicyMode[] = ["default_only", "default_plus_rego"];

    expect(modes).toHaveLength(2);
  });

  it("fairness flag values cover expected cases", () => {
    const flags = [
      "zero_planned_opportunity",
      "low_period_participation",
      "high_recent_load",
      "eligible_not_selected",
      "consecutive_support_burden",
      "gk_coverage_gap",
      "position_coverage_weakness",
      "team_disproportionate_support",
    ];

    expect(flags).toHaveLength(8);
  });

  it("conflict type values cover expected cases", () => {
    const conflictTypes = [
      "player_league_event_overlap",
      "helper_conflict",
      "player_overuse_same_week",
      "unavailable_player_planned",
      "gk_conflict",
      "position_coverage_conflict",
    ];

    expect(conflictTypes).toHaveLength(6);
  });
});