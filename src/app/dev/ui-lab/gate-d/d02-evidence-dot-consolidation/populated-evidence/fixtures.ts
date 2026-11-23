import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PlayerEvidenceStoryData } from "@/lib/touchline/presentation/player-evidence-view-model";

/**
 * Gate D register D02 ("Player Detail / Evidence — profile-level dot consolidation without
 * losing exact sided drill-down or double-counting"). Populated state: all four groups have
 * real, established evidence. The `POSITION` story's `positionShares` is the real consolidation
 * mechanism already in production (`StackedDistribution` over the exact sided codes,
 * `EvidenceStory`'s `sample` line keeping the match count visible) — each exact code keeps its
 * own named share (never merged into a single anonymous "defender" bucket) and the shares sum to
 * 100, so nothing is double-counted.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D02-POPULATED",
  fixtureId: "gate-d-w1-d02-populated-evidence",
  fixtureVersion: 1,
  fixtureSha256: "7e7b17701e86c1336b0797be6ee51bcd48e47b9bb5809a496e8cefc393a6efa2",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const stories: PlayerEvidenceStoryData[] = [
  {
    id: "gate-d-w1-d02-opportunity",
    group: "OPPORTUNITY",
    question: "Has this player had a recent match opportunity?",
    title: "Recent opportunities have been consistent",
    value: "6 / 7",
    valueCaption: "eligible rounds with a planned opportunity",
    sample: "7 eligible rounds",
    confidence: "Established",
    interpretation: "Opportunity appeared in most recent eligible rounds.",
    sparkline: [100, 100, 0, 100, 100, 100, 100],
    sparklineLabels: ["R1", "R2", "R3", "R4", "R5", "R6", "R7"],
  },
  {
    id: "gate-d-w1-d02-position",
    group: "POSITION",
    question: "Which positions has this player actually played?",
    title: "Centre Back is the dominant actual position",
    sample: "12 matches with recorded actual position",
    confidence: "Established",
    interpretation: "Centre Back accounts for most recorded minutes; Right Centre Back and Centre Defensive Midfield make up the remainder.",
    positionShares: [
      { code: "CB", sharePercent: 58 },
      { code: "RCB", sharePercent: 25 },
      { code: "CDM", sharePercent: 17 },
    ],
  },
  {
    id: "gate-d-w1-d02-match-context",
    group: "MATCH_CONTEXT",
    question: "In what match context has this player appeared?",
    title: "Mostly core-squad minutes this season",
    value: "9 / 12",
    valueCaption: "matches in a core-squad role",
    sample: "12 matches",
    confidence: "Established",
    interpretation: "Core-squad appearances outnumber support and development minutes this season.",
    positionShares: [
      { code: "CORE", sharePercent: 75 },
      { code: "SUPPORT", sharePercent: 17 },
      { code: "DEVELOPMENT", sharePercent: 8 },
    ],
  },
  {
    id: "gate-d-w1-d02-trend",
    group: "TREND",
    question: "Has this player's on-pitch role changed recently?",
    title: "Defensive-midfield minutes are trending up",
    sample: "6 eligible matches",
    confidence: "Emerging",
    interpretation: "Time spent in a defensive-midfield role has increased across the most recent eligible matches.",
    sparkline: [8, 10, 14, 19, 24, 31],
    sparklineLabels: ["M1", "M2", "M3", "M4", "M5", "M6"],
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D02-POPULATED", stories };
