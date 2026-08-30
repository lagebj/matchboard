# Situational Decision Support

## Status

**Partial.** This document records the target architecture authorised by ADR-0107.

Implemented as of ADR-0107:
- OPA/Rego is a standard runtime capability (no enable/disable gate).
- Policy pack schema v2 (named multi-entrypoint packs).
- The `matchboard/situation/decision` Rego entrypoint exists on the built-in `matchboard-default`
  pack, compiled, tested (`policies/packs/matchboard-default/rego/matchboard_situation*.rego`),
  and evaluable via the shared policy runtime (`src/lib/policies/policy-runtime.ts`).

**Not yet implemented** (tracked for follow-up work, not claimed as current behaviour):
- The TypeScript `SituationContext` resolver.
- `CoachDecisionCandidate` / candidate provider interfaces and any concrete providers.
- The `CoachDecision` normalization layer and `getCoachSituationProjection()` query boundary.
- Today, Matchday mobile, Next, and Long-term UI migration to consume the projection.
- Direct-action wiring, mobile Playwright coverage, and the remaining quality gates in the
  programme bundle.

Do not treat the type shapes below as already wired into Today, the Round Board, or any other UI
surface until this status section is updated to say so.

## Problem

Matchboard's coach-facing workflow is organised around modules/categories (Today's
`AssistantWorkItem` + category-level priority, League, Events, Players, Insights). The same
underlying fact can matter differently depending on the coach's current situation — a live match
20 minutes from kickoff is a different situation from planning next week's round, which is
different again from a season development review. There is currently no shared mechanism for
contextual relevance; each surface would otherwise reinvent its own priority ordering.

## Architecture decision

See ADR-0107 for the full decision record. Summary:

```text
DOMAIN STATE
    ↓
FACT / SIGNAL / RECOMMENDATION PRODUCERS (existing domain owners)
    ↓
COACH DECISION CANDIDATES (normalized, provider-produced)
    ↓
SITUATION CONTEXT (deterministic TypeScript resolver)
    ↓
OPA/REGO SITUATION POLICY (matchboard/situation/decision)
    ↓
NORMALIZED COACH DECISIONS
    ↓
SITUATIONAL PROJECTIONS
    ├── MATCHDAY
    ├── NEXT
    └── LONG_TERM
    ↓
DEEP DOMAIN WORKSPACES WHEN NEEDED (Round Board, live reporting, Insights, ...)
```

One domain model, several projections. `MATCHDAY`/`NEXT`/`LONG_TERM` are contextual projections,
never persistent application modes, never parallel sources of truth.

### Division of responsibility

TypeScript/domain owns: database access, authorisation/tenancy, football/domain invariants, fact
derivation, time calculations, recommendations from existing engines, possible actions, command
execution, transactions.

OPA/Rego owns: contextual visibility/promotion/suppression, urgency, decision horizon, interaction
depth, reason codes, configurable policy treatment. Rego must never query Prisma, generate squads,
optimise lineups, calculate evidence from raw match history, mutate application state, or own a
transaction boundary.

## Type contracts (design target)

Exact names/locations should follow repository convention when implemented; reuse existing
`Recommendation`/entity-reference/`DecisionRecord` concepts where semantics already match instead
of creating parallel types.

```ts
type CoachingSituation = "MATCHDAY" | "NEXT" | "LONG_TERM";

type SituationContext = {
  nowIso: string;
  primarySituation: CoachingSituation;
  activeMatchId?: string;
  imminentMatchIds: string[];
  nextRoundId?: string;
  routeIntent?: "TODAY" | "MATCH" | "ROUND" | "EVENT" | "PLAYER" | "INSIGHTS" | "DOMAIN_MANAGEMENT";
  temporal: {
    nearestKickoffMinutes?: number;
    nextRoundDays?: number;
  };
};

type DecisionEntityType = "ROUND" | "MATCH" | "TEAM" | "PLAYER" | "EVENT" | "REPORT" | "SELECTION" | "AVAILABILITY";

type DecisionConsequence =
  | "MATCH_NOT_PLAYABLE"
  | "SQUAD_DEGRADED"
  | "PLANNING_BLOCKED"
  | "PLAYER_OPPORTUNITY"
  | "POSITION_COVERAGE"
  | "RESPONSIBILITY_GAP"
  | "REPORTING_DEBT"
  | "DEVELOPMENT_SIGNAL"
  | "INFORMATION_ONLY";

type CoachDecisionCandidate = {
  id: string;
  source: string; // provider id
  entityType: DecisionEntityType;
  entityId: string;
  title: string;
  facts: { code: string; numericValue?: number; booleanValue?: boolean; playerId?: string }[];
  consequences: DecisionConsequence[];
  affectedMatchIds: string[];
  affectedTeamIds: string[];
  affectedPlayerIds: string[];
  deadlineAt?: string;
  eventAt?: string;
  recommendedActions: DecisionActionCandidate[];
  alternativeActions: DecisionActionCandidate[];
  defaultDeepLink?: string;
  reversibleUntil?: string;
  sourceConfidence?: "LOW" | "MEDIUM" | "HIGH";
};

type DecisionVisibility = "PROMOTE" | "NORMAL" | "DEFER" | "SUPPRESS";
type DecisionHorizon = "NOW" | "BEFORE_NEXT_MATCH" | "NEXT" | "LONG_TERM";
type DecisionUrgency = "IMMEDIATE" | "SOON" | "NORMAL" | "LOW";
type DecisionInteraction = "INFORM" | "CONFIRM" | "CHOOSE" | "REVIEW" | "AUTO"; // AUTO reserved,
  // never used for player/squad/lineup/opportunity/report/development mutations

type CoachDecision = {
  id: string;
  situation: CoachingSituation;
  horizon: DecisionHorizon;
  visibility: DecisionVisibility;
  urgency: DecisionUrgency;
  interaction: DecisionInteraction;
  question: string;
  summary: string;
  whyItMatters: string;
  consequenceOfNoAction?: string;
  recommendedAction?: DecisionActionCandidate;
  alternatives: DecisionActionCandidate[];
  affectedEntities: { entityType: DecisionEntityType; entityId: string }[];
  deadlineAt?: string;
  deepLink?: string;
  reasonCodes: string[];
};

type CoachSituationProjection = {
  situation: SituationContext;
  decisions: CoachDecision[];
  deferredCount: number;
  status: "ACTION_REQUIRED" | "READY" | "LIVE" | "REVIEW_AVAILABLE";
  policyRuntimeStatus: "HEALTHY" | "DEGRADED";
};
```

Facts sent to the `situation` Rego entrypoint are compact, versionable, deterministic, tenant-safe
primitives — never raw Prisma/domain aggregate objects. See the entrypoint's own doc comment in
`policies/packs/matchboard-default/rego/matchboard_situation.rego` for the exact input/output
shape currently implemented and tested.

## Situation policy (implemented, unwired)

`matchboard/situation/decision` (package `matchboard.situation`) takes:

```json
{
  "situation": { "primary": "MATCHDAY", "active_match": false },
  "candidate": {
    "source": "availability",
    "consequences": ["SQUAD_DEGRADED", "POSITION_COVERAGE"],
    "deadline_minutes": 30,
    "has_recommendation": true,
    "alternative_count": 1,
    "is_long_term_signal": false,
    "affects_next_round_decision": false,
    "requires_review": false
  }
}
```

and returns:

```json
{
  "visibility": "PROMOTE",
  "horizon": "NOW",
  "urgency": "IMMEDIATE",
  "interaction": "CONFIRM",
  "reason_codes": ["HARD_CONSEQUENCE", "MATCH_IMMINENT", "RECOMMENDATION_AVAILABLE"],
  "suppress_nonessential_context": true
}
```

Proven scenarios (fixture-tested, `matchboard_situation_test.rego`): unavailable-player
consequence promoted on Matchday and demoted to a `NEXT`-horizon decision five days out; missing
goalkeeper/position coverage promoted on Matchday and treated as a `NEXT` planning decision
otherwise; a stale/incomplete report deferred during imminent Matchday preparation but visible as
post-match work otherwise; a long-term development/opportunity signal suppressed during an
unrelated live match, allowed to influence a `NEXT` tie-break when it affects the next round's
decision, and promoted as primary content in a `LONG_TERM` review; `interaction` never resolves to
`AUTO`.

Nothing in the application calls this entrypoint yet — there is no candidate provider, no
TypeScript situation resolver, and no projection service wiring it into a coach-facing surface.
That is the next phase of this work.

## Safe degraded behaviour

If the built-in pack's runtime evaluation fails unexpectedly, the situation entrypoint (like the
selection entrypoint) must degrade rather than throw: mark policy runtime `DEGRADED`, never invent
suppression (suppression cannot be trusted when the policy that would decide it is itself
unavailable), never use `AUTO`, order by hard consequences/deadlines only, keep TypeScript domain
invariants and authorisation fully active, and surface an admin/developer diagnostic rather than a
coach-facing technical error. This is provided today by the shared runtime
(`evaluatePolicyEntrypoint()` in `policy-runtime.ts`) for any caller of the `situation` entrypoint,
even though no caller exists yet.

## Related

- ADR-0107 (architecture decision, includes the full division-of-responsibility rationale and the
  OPA/Rego standard-runtime change this depends on).
- `policies/packs/matchboard-default/rego/matchboard_situation.rego` /
  `matchboard_situation_test.rego` — implemented, tested situation policy source.
- `.matchboard-work/situational-decision-support/` (untracked, gitignored working bundle) — the
  full original programme specification this document and ADR-0107 were derived from.
