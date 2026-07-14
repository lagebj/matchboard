import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { evaluateDefaultMatchboardPolicy } from "@/lib/policies/default-matchboard-policy";
import type { SelectionPolicyInput } from "@/lib/policies/types";

type FixtureFile = {
  id: string;
  label: string;
  description: string;
  decisionType: string;
  mode: string;
  input: SelectionPolicyInput;
};

const FIXTURES_DIR = path.resolve(__dirname, "../../../../test/fixtures/workbench");

const FIXTURE_FILENAMES = [
  "league-match-selection.json",
  "league-round-fairness.json",
  "event-balanced-three-squads.json",
  "event-competitive-topped-plus-balanced.json",
  "event-weak-goalkeeper-coverage.json",
  "event-pool-restricted.json",
  "event-helper-overlap.json",
];

function loadFixture(filename: string): FixtureFile {
  const filePath = path.join(FIXTURES_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as FixtureFile;
}

function _loadAllFixtures(): FixtureFile[] {
  return FIXTURE_FILENAMES.map(loadFixture);
}

describe("Workbench fixture files", () => {
  it("all fixture files have required top-level fields", () => {
    for (const filename of FIXTURE_FILENAMES) {
      const fixture = loadFixture(filename);

      expect(fixture.id, `${filename}: id`).toBeTruthy();
      expect(fixture.label, `${filename}: label`).toBeTruthy();
      expect(fixture.description, `${filename}: description`).toBeTruthy();
      expect(fixture.decisionType, `${filename}: decisionType`).toBeTruthy();
      expect(fixture.mode, `${filename}: mode`).toBeTruthy();
      expect(fixture.input, `${filename}: input`).toBeTruthy();
      expect(fixture.input.context, `${filename}: input.context`).toBeTruthy();
      expect(fixture.input.players, `${filename}: input.players`).toBeInstanceOf(Array);
    }
  });

  it("all fixture contexts have valid mode and decisionType", () => {
    const validModes = ["league", "event"];
    const validDecisionTypes = [
      "league_match_selection",
      "league_round_fairness",
      "event_squad_generation",
      "event_helper_selection",
      "event_lineup_planning",
      "post_match_report_availability",
    ];

    for (const filename of FIXTURE_FILENAMES) {
      const fixture = loadFixture(filename);

      expect(validModes, `${filename}: mode`).toContain(fixture.mode);
      expect(validDecisionTypes, `${filename}: decisionType`).toContain(fixture.decisionType);
      expect(fixture.input.context.mode, `${filename}: context.mode`).toBe(fixture.mode);
      expect(fixture.input.context.decisionType, `${filename}: context.decisionType`).toBe(fixture.decisionType);
    }
  });

  it("all fixture players have required fields", () => {
    for (const filename of FIXTURE_FILENAMES) {
      const fixture = loadFixture(filename);

      for (const player of fixture.input.players) {
        expect(player.id, `${filename}: player.id`).toBeTruthy();
        expect(player.status, `${filename}: player ${player.id} status`).toBeTruthy();
        expect(typeof player.availableForContext, `${filename}: player ${player.id} availableForContext`).toBe("boolean");
      }
    }
  });

  it("all fixtures produce a valid policy result", () => {
    for (const filename of FIXTURE_FILENAMES) {
      const fixture = loadFixture(filename);

      const result = evaluateDefaultMatchboardPolicy(fixture.input);

      expect(result, `${filename}: result`).toBeTruthy();
      expect(result.allowedPlayerIds, `${filename}: allowedPlayerIds`).toBeInstanceOf(Array);
      expect(typeof result.blocked, `${filename}: blocked`).toBe("object");
      expect(result.warnings, `${filename}: warnings`).toBeInstanceOf(Array);
      expect(result.explanations, `${filename}: explanations`).toBeInstanceOf(Array);
    }
  });

  it("league-match-selection fixture blocks removed and unavailable players", () => {
    const fixture = loadFixture("league-match-selection.json");
    const result = evaluateDefaultMatchboardPolicy(fixture.input);

    expect(result.blocked["player-removed"]).toContain("removed_player_cannot_be_selected");
    expect(result.allowedPlayerIds).not.toContain("player-removed");
    expect(result.blocked["player-unavail"]).toContain("unavailable_player_cannot_be_selected");
  });

  it("league-match-selection fixture produces fairness score adjustments for low-activity players", () => {
    const fixture = loadFixture("league-match-selection.json");
    const result = evaluateDefaultMatchboardPolicy(fixture.input);

    expect(result.scoreAdjustments.length).toBeGreaterThan(0);
    const lowMatchAdjustments = result.scoreAdjustments.filter(
      (a) => a.code === "low_recent_match_count" || a.code === "low_period_match_count" || a.code === "low_season_match_count",
    );
    expect(lowMatchAdjustments.length).toBeGreaterThan(0);
  });

  it("event-balanced-three-squads fixture blocks unavailable players", () => {
    const fixture = loadFixture("event-balanced-three-squads.json");
    const result = evaluateDefaultMatchboardPolicy(fixture.input);

    const unavailablePlayers = fixture.input.players.filter(
      (p) => !p.availableForContext && p.status !== "REMOVED" && p.status !== "INACTIVE",
    );
    for (const player of unavailablePlayers) {
      expect(result.blocked[player.id]).toContain("unavailable_player_cannot_be_selected");
    }
  });

  it("all policy results have source attribution on warnings and explanations", () => {
    for (const filename of FIXTURE_FILENAMES) {
      const fixture = loadFixture(filename);
      const result = evaluateDefaultMatchboardPolicy(fixture.input);

      for (const w of result.warnings) {
        expect(w.source, `${filename}: warning "${w.code}" should have source`).toBe("default_policy");
      }
      for (const e of result.explanations) {
        if (e.hardRule) {
          expect(e.source, `${filename}: hard rule explanation "${e.code}" should have source "core"`).toBe("core");
        } else {
          expect(e.source, `${filename}: explanation "${e.code}" should have source`).toBe("default_policy");
        }
      }
      for (const a of result.scoreAdjustments) {
        expect(a.source, `${filename}: adjustment "${a.code}" should have source`).toBe("default_policy");
      }
    }
  });

  it("all fixtures use anonymized player and team identifiers", () => {
    for (const filename of FIXTURE_FILENAMES) {
      const fixture = loadFixture(filename);

      for (const player of fixture.input.players) {
        expect(player.id, `${filename}: player id should be anonymized`).toMatch(/^(player-|player_[a-z])/);
      }
      for (const team of fixture.input.teams) {
        expect(team.id, `${filename}: team id should be anonymized`).toMatch(/^(team-|team_[a-z])/);
      }
    }
  });
});