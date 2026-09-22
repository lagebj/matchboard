import { categoryForFactType, deriveRelevanceFromPriority, rankInsightCandidates } from "./ranking";
import type { CurrentPlanInput, MatchInsightCandidate, MatchInsightFact, PlayerPreparationSummary } from "./types";

/**
 * Layer A: turns computed facts into directly-renderable, coach-facing insight candidates
 * (ADR-0149 Decision 4; bundle §4 "the deterministic service should be able to emit usable
 * insights directly for important facts"). Pure and synchronous — every fact this module needs
 * was already fetched by `build-match-insight-facts.ts`.
 *
 * Deliberately gated, not one insight per fact (bundle §3 "do not fill empty space with low-value
 * observations"): a fact is only promoted to a candidate when it is a genuine exception,
 * confirmation-worth-surfacing, or something the bundle explicitly calls out as preparation-
 * relevant. An unremarkable fact (e.g. a usual starter who is, unremarkably, started again) stays
 * a fact only — still available as evidence/provenance, never forced into the primary list.
 *
 * Never labels a player strong/weak/better/worse (bundle §4/§6) — every sentence below states an
 * observation, never a comparison of ability.
 */

const MIN_NOTABLE_GOAL_INVOLVEMENT = 3;

function playerName(id: string, playerNameById: Map<string, string>): string {
  return playerNameById.get(id) ?? "A player";
}

function pluralMatches(n: number): string {
  return `${n} match${n === 1 ? "" : "es"}`;
}

type InsightBuilderParams = {
  fact: MatchInsightFact;
  plan: CurrentPlanInput;
  playerSummaries: Map<string, PlayerPreparationSummary>;
  playerNameById: Map<string, string>;
};

function candidateFromFact(
  fact: MatchInsightFact,
  parts: { title: string; observation: string; implication?: string },
): MatchInsightCandidate {
  return {
    id: fact.id,
    category: categoryForFactType(fact.type),
    relevance: deriveRelevanceFromPriority(fact.deterministicPriority),
    title: parts.title,
    observation: parts.observation,
    implication: parts.implication,
    subjectRefs: fact.subjectRefs,
    factRefs: [fact.id],
    evidenceRefs: fact.evidenceRefs,
    confidence: fact.confidence,
    source: "DETERMINISTIC",
  };
}

function buildStartingPatternInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate | null {
  const value = fact.value as { starts: number; matchesConsidered: number; plannedRole: string | null };
  const [playerId] = fact.subjectRefs;
  const isFullyAbsent = value.starts === 0 && value.plannedRole === "CORE";
  if (!isFullyAbsent) return null;

  return candidateFromFact(fact, {
    title: "Recent opportunity",
    observation: `${playerName(playerId, playerNameById)} has not started in the previous ${pluralMatches(value.matchesConsidered)} and is planned to start this match.`,
    implication: "Worth reviewing before finalising.",
  });
}

function buildPositionPatternInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate | null {
  const value = fact.value as { plannedPosition: string; isDeclaredPosition: boolean };
  if (value.isDeclaredPosition) return null;
  const [playerId] = fact.subjectRefs;

  return candidateFromFact(fact, {
    title: "Unusual planned position",
    observation: `${playerName(playerId, playerNameById)} is planned at ${value.plannedPosition}, outside their declared positions.`,
    implication: "Worth observing.",
  });
}

function buildPositionExposureInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate | null {
  if (fact.confidence !== "LOW") return null;
  const value = fact.value as { position: string; minutes: number };
  const [playerId] = fact.subjectRefs;
  if (value.minutes > 0) return null; // some recorded exposure -- LOW confidence, but not absent.

  return candidateFromFact(fact, {
    title: "Limited positional evidence",
    observation: `${playerName(playerId, playerNameById)} has no recorded playing time at ${value.position} this season.`,
    implication: "Worth observing.",
  });
}

function buildGoalInvolvementInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate | null {
  const value = fact.value as { goals: number; assists: number };
  if (value.goals + value.assists < MIN_NOTABLE_GOAL_INVOLVEMENT) return null;
  const [playerId] = fact.subjectRefs;

  return candidateFromFact(fact, {
    title: "Goal involvement this season",
    observation: `${playerName(playerId, playerNameById)} has ${value.goals} goal${value.goals === 1 ? "" : "s"} and ${value.assists} assist${value.assists === 1 ? "" : "s"} this season.`,
  });
}

function buildGoalCombinationInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate {
  const [a, b] = fact.subjectRefs;
  const value = fact.value as { directGoalContributionsTotal: number; directAssistContributionsTotal: number };

  return candidateFromFact(fact, {
    title: "Attacking combination",
    observation: `${playerName(a, playerNameById)} and ${playerName(b, playerNameById)} have combined directly for ${value.directGoalContributionsTotal + value.directAssistContributionsTotal} goal${value.directGoalContributionsTotal + value.directAssistContributionsTotal === 1 ? "" : "s"}/assist${value.directGoalContributionsTotal + value.directAssistContributionsTotal === 1 ? "" : "s"} this season.`,
  });
}

function buildStartsTogetherInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate | null {
  if (fact.confidence !== "HIGH") return null; // ESTABLISHED confidence only -- EMERGING stays evidence-only.
  const [a, b] = fact.subjectRefs;
  const value = fact.value as { minutesTogether: number; matchCount: number };

  return candidateFromFact(fact, {
    title: "Established combination",
    observation: `${playerName(a, playerNameById)} and ${playerName(b, playerNameById)} have played ${Math.round(value.minutesTogether)} minutes together across ${pluralMatches(value.matchCount)} this season.`,
  });
}

function buildNewCombinationInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate {
  const [a, b] = fact.subjectRefs;
  const value = fact.value as { position: string | null };
  const positionText = value.position ? ` at ${value.position}` : "";

  return candidateFromFact(fact, {
    title: "New combination",
    observation: `${playerName(a, playerNameById)} and ${playerName(b, playerNameById)} have not previously started together${positionText}.`,
    implication: "Worth observing.",
  });
}

function buildLineupContinuityInsight({ fact }: InsightBuilderParams): MatchInsightCandidate {
  const value = fact.value as { unchangedPlayerCount: number; changedPlayerCount: number };

  return candidateFromFact(fact, {
    title: "Line-up changes",
    observation: `${value.changedPlayerCount} change${value.changedPlayerCount === 1 ? "" : "s"} from the previous match's line-up, with ${value.unchangedPlayerCount} unchanged.`,
  });
}

function buildFormationPatternInsight({ fact }: InsightBuilderParams): MatchInsightCandidate {
  const value = fact.value as { formation: string; matchesUsedInWindow: number; windowSize: number };

  return candidateFromFact(fact, {
    title: "Formation change",
    observation: `${value.formation} was used in ${value.matchesUsedInWindow} of the last ${value.windowSize} matches.`,
    implication: "Worth observing.",
  });
}

function buildDevelopmentContextInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate {
  const [playerId] = fact.subjectRefs;
  const value = fact.value as { categories: string[] };

  return candidateFromFact(fact, {
    title: "Active development focus",
    observation: `${playerName(playerId, playerNameById)} has an active development focus: ${value.categories.join(", ")}.`,
  });
}

function buildOpponentEncounterInsight({ fact }: InsightBuilderParams): MatchInsightCandidate {
  const value = fact.value as { encounters: { occurredAt: string; goalsFor: number; goalsAgainst: number; formation: string | null }[] };
  const [latest] = value.encounters;

  return candidateFromFact(fact, {
    title: "Previous encounter",
    observation: latest
      ? `Last met on ${new Date(latest.occurredAt).toISOString().slice(0, 10)}, result ${latest.goalsFor}-${latest.goalsAgainst}${latest.formation ? ` (${latest.formation})` : ""}. ${value.encounters.length} previous encounter${value.encounters.length === 1 ? "" : "s"} recorded.`
      : `${value.encounters.length} previous encounter${value.encounters.length === 1 ? "" : "s"} recorded.`,
  });
}

function buildOpponentObservationInsight({ fact }: InsightBuilderParams): MatchInsightCandidate | null {
  const value = fact.value as {
    overallEnvironment: string | null;
    playingStyleTags: string[];
    trustedObservation: { text: string; source: string } | null;
  };
  const parts: string[] = [];
  if (value.playingStyleTags.length > 0) {
    parts.push(`Recorded playing style: ${value.playingStyleTags.join(", ").toLowerCase().replace(/_/g, " ")}.`);
  }
  if (value.trustedObservation) {
    parts.push(`Coach observation from that encounter: "${value.trustedObservation.text}"`);
  }
  if (parts.length === 0) return null;

  return candidateFromFact(fact, {
    title: "Opponent observation",
    observation: parts.join(" "),
    implication: "Attributed coach observation, not a confirmed fact.",
  });
}

function buildOpponentTrendInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate {
  const value = fact.value as { combinations: { playerIds: [string, string]; matchCount: number }[] };
  const [top] = value.combinations;

  return candidateFromFact(fact, {
    title: "Combination history against this opponent",
    observation: top
      ? `${playerName(top.playerIds[0], playerNameById)} and ${playerName(top.playerIds[1], playerNameById)} have recorded combination evidence in ${pluralMatches(top.matchCount)} against this opponent.`
      : "Combination evidence recorded against this opponent.",
  });
}

function buildRotationContextInsight({ fact, playerNameById }: InsightBuilderParams): MatchInsightCandidate | null {
  const value = fact.value as { inPlayerId: string | null; inboundRecentStarts: number | null };
  if (value.inboundRecentStarts !== 0 || !value.inPlayerId) return null;

  return candidateFromFact(fact, {
    title: "Planned rotation",
    observation: `${playerName(value.inPlayerId, playerNameById)} is planned to enter via rotation without a recent start.`,
    implication: "Worth observing.",
  });
}

const BUILDERS: Record<MatchInsightFact["type"], (params: InsightBuilderParams) => MatchInsightCandidate | null> = {
  STARTING_PATTERN: buildStartingPatternInsight,
  POSITION_PATTERN: buildPositionPatternInsight,
  POSITION_EXPOSURE: buildPositionExposureInsight,
  ATTRIBUTE_PROFILE: () => null, // provenance-only -- never a standalone insight (always true, not an exception).
  GOAL_INVOLVEMENT: buildGoalInvolvementInsight,
  GOAL_COMBINATION: buildGoalCombinationInsight,
  STARTS_TOGETHER: buildStartsTogetherInsight,
  NEW_COMBINATION: buildNewCombinationInsight,
  LINEUP_CONTINUITY: buildLineupContinuityInsight,
  FORMATION_PATTERN: buildFormationPatternInsight,
  DEVELOPMENT_CONTEXT: buildDevelopmentContextInsight,
  OPPONENT_ENCOUNTER: buildOpponentEncounterInsight,
  OPPONENT_OBSERVATION: buildOpponentObservationInsight,
  OPPONENT_TREND: buildOpponentTrendInsight,
  ROTATION_CONTEXT: buildRotationContextInsight,
};

export function buildDeterministicInsights(params: {
  facts: MatchInsightFact[];
  plan: CurrentPlanInput;
  playerSummaries: Map<string, PlayerPreparationSummary>;
  playerNameById: Map<string, string>;
}): MatchInsightCandidate[] {
  const candidates: MatchInsightCandidate[] = [];

  for (const fact of params.facts) {
    const builder = BUILDERS[fact.type];
    const candidate = builder({ fact, plan: params.plan, playerSummaries: params.playerSummaries, playerNameById: params.playerNameById });
    if (candidate) candidates.push(candidate);
  }

  return rankInsightCandidates(candidates);
}
