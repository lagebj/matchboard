import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PlayerEvidenceStoryData } from "@/lib/touchline/presentation/player-evidence-view-model";

/**
 * Gate D register D02, sparse state: a new or rarely-fielded player with partial and unknown
 * data. `confidence: null` on the Opportunity and Position stories renders the real
 * insufficient-evidence state (`EvidenceStory`'s own "Not enough evidence yet" branch) rather
 * than a fabricated value. The Match context group has no qualifying story at all and is
 * omitted entirely by `EvidenceGroups` — matching the real Evidence tab's own
 * `if (stories.length === 0) return null` behavior, not a fabricated "no data" card.
 *
 * Remediation (2026-11-24): the single `LM` exact share now also renders through
 * `ConsolidatedPositionEvidence` — with only one exact code, the profile-level view is trivially
 * `LM 100%` (no other code shares its profile group), exercising the "no evidence to consolidate
 * beyond one code" edge of the real aggregation function rather than only the populated case.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D02-SPARSE",
  fixtureId: "gate-d-w1-d02-sparse-evidence",
  fixtureVersion: 2,
  fixtureSha256: "8ddbc8c2bcb574fabc4ccf84b0220c798aec7a10ae6f08be244a7e9f9c84ff99",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const stories: PlayerEvidenceStoryData[] = [
  {
    id: "gate-d-w1-d02-sparse-opportunity",
    group: "OPPORTUNITY",
    question: "Has this player had a recent match opportunity?",
    title: "Not enough eligible rounds yet to judge opportunity",
    sample: "1 eligible round",
    confidence: null,
  },
  {
    id: "gate-d-w1-d02-sparse-position",
    group: "POSITION",
    question: "Which positions has this player actually played?",
    title: "One recorded appearance so far",
    sample: "1 match with recorded actual position",
    confidence: null,
    positionShares: [{ code: "LM", sharePercent: 100 }],
  },
  {
    id: "gate-d-w1-d02-sparse-trend",
    group: "TREND",
    question: "Has this player's on-pitch role changed recently?",
    title: "Not enough eligible matches yet for a trend",
    sample: "2 of 6 eligible matches",
    confidence: null,
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D02-SPARSE", stories };
