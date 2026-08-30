# Situational Decision Support

## Status

**Partial.** This document records the target architecture authorised by ADR-0107.

Implemented:
- OPA/Rego is a standard runtime capability (no enable/disable gate).
- Policy pack schema v2 (named multi-entrypoint packs).
- The `matchboard/situation/decision` Rego entrypoint exists on the built-in `matchboard-default`
  pack, compiled, tested (`policies/packs/matchboard-default/rego/matchboard_situation*.rego`),
  and evaluable via the shared policy runtime (`src/lib/policies/policy-runtime.ts`).
- The TypeScript `SituationContext` resolver (`src/lib/situational/resolve-situation-context.ts`).
- `CoachDecisionCandidate` / `DecisionCandidateProvider` contracts
  (`src/lib/situational/situation-types.ts`), a typed situation-policy adapter with a safe
  degraded fallback (`src/lib/situational/situation-policy-adapter.ts`), and the projection service
  (`src/lib/situational/get-coach-situation-projection.ts`).
- Two real candidate providers:
  - `assistantWorkItemsToCandidates()` (`src/lib/situational/providers/assistant-candidate-provider.ts`)
    adapts existing `AssistantWorkItem`s (from `getAssistantCommandCentre()`) into normalized
    candidates — `AssistantWorkItem` is not deleted; this is an additive adapter, per the
    migration path below. Accepts an `excludeCategories` option so a richer provider can take over
    specific categories without double-representing the same problem.
  - `createPlanIntegrityCandidateProvider()` (`src/lib/situational/providers/plan-integrity-candidate-provider.ts`)
    adapts `computeRoundPlanIntegrity()`'s per-signal output (BLOCKED/DECISION_REQUIRED only) into
    one candidate **per signal** — finer-grained than the Assistant adapter's one-aggregated-item-
    per-round `blocked_round`/`decision_required` categories, which it replaces (Today excludes
    those two categories from the Assistant adapter once this provider is also registered — see
    "Today is partially migrated" below). Takes already-computed `RoundPlanIntegrity` data
    (`AssistantCommandCentre.roundPlanIntegrities`, exposed for exactly this reuse) rather than
    recomputing it — `getAssistantCommandCentre()` already computed it once per DRAFT round.
- **Today is partially migrated**: `/o/{orgSlug}/today` (`src/app/(app)/o/[orgSlug]/today/page.tsx`)
  resolves a `SituationContext` from `commandCentre.todayMatches` (no new queries), builds
  candidates from all four providers, evaluates the situation policy, and passes the resulting
  `CoachSituationProjection` to `AssistantCommandCentrePage`. The projection — not
  `CATEGORY_PRIORITY` array order — now determines which single item is featured as the hero
  "Next action" (`resolveNextAction()` in `assistant-command-centre-page.tsx`), and correctly
  shows no hero at all (not a stale fallback item) when the projection legitimately produced zero
  decisions — see "Explicit ready-state display" below for the bug this fixed. The summary metric
  tiles above the hero are **not yet** situationally filtered — see "Not yet implemented" below;
  the grouped sections beneath the hero **are** now annotated and reordered (see "Situational
  annotation and reordering" below). `CATEGORY_PRIORITY` remains in place for grouping/
  diagnostics use, which the programme's own spec explicitly allows
  (`04-PROJECTION-AND-UI-SPEC.md` §2: "If category information remains useful for grouping or
  diagnostics, it must not control primary urgency ahead of the situational policy" — satisfied
  for the hero and now the grouped sections; not yet for the metric-tile row).
- **Explicit ready-state display (SDS-019) and a real hero-selection bug fix**:
  `resolveNextAction()` previously fell back to raw `actionable[0]` order whenever
  `projection.decisions` was empty — even when the projection existed and had deliberately
  produced zero decisions (every candidate was suppressed/deferred by the situation policy). This
  silently defeated situational ordering in exactly the case where the policy concluded "nothing
  should be featured." **This is safe to fix without risking Blocked/Decision-required
  visibility**: those categories' plan-integrity candidates always carry a hard consequence
  (`SQUAD_DEGRADED`/`PLANNING_BLOCKED`), and `matchboard_situation.rego`'s `hard_consequences` set
  is structurally exempt from `SUPPRESS` — so `decisions` can only be empty here when every
  actionable item was a soft, non-hard-consequence signal. Fixed: `resolveNextAction()` now
  returns no hero (triggering the empty state) when a projection exists but produced zero
  decisions, distinct from the "no projection at all" graceful-degradation case (which still falls
  back to raw order). `readyStateCopy()` gives the resulting empty state distinct wording for
  `projection.status === "LIVE"` ("Nothing else needs attention while today's match is live.")
  versus `READY`/no-projection (the pre-existing "Nothing urgent right now."). `REVIEW_AVAILABLE`
  and `ACTION_REQUIRED` can never reach the empty state by construction (see
  `computeStatus()`), so only these two cases needed distinguishing.

- **Matchday mobile (Phase 5, first slice)**: `MatchdayContextBanner`
  (`assistant-command-centre-page.tsx`) renders, additively, above the existing hero whenever the
  projection has inferred `MATCHDAY` (a relevant match is live or imminent — see
  `resolve-situation-context.ts`) and a matching `TodayMatch` can be found. Shows match identity
  (team vs opponent), a live-now/kickoff-countdown status pill, and one primary action: "Follow
  live" (routes to the existing `/matches/{id}/live` live-reporting page, only when a live session
  is already active) or "Open match" (routes to `/matches/{id}` otherwise, where the coach can
  start live reporting from the existing entry point). It does not replace or duplicate the live
  reporter, does not introduce any new mutation, and does not touch the existing hero/grouped
  content below it. Verified in a real browser at desktop, 390×844 phone, and 768×1024 tablet
  viewports (see `docs/development/browser-acceptance-testing.md` / the `verify-browser-acceptance`
  swamp procedure) with no new accessibility violations.

- **Next round readiness (Phase 6, first slice)**: `NextRoundReadinessSection`
  (`assistant-command-centre-page.tsx`) renders, additively, whenever the projection has inferred
  `NEXT` and at least one round in `roundPlanIntegrities` has a blocked or decision-required
  signal. Lists each such round (name, blocked/decision-required counts) with one "Open Round
  Board" action deep-linking to the existing `/rounds/{id}` workspace — the Round Board itself is
  unchanged; this only surfaces readiness above it, per the programme's "coach can see next-round
  decisions and readiness before entering the full Round Board" acceptance criterion. No inline
  mutation/direct-action wiring yet — every action here is navigation only.

- **Long-term foundation (Phase 7, first slice)**: `opportunityGapRowsToCandidates()`
  (`src/lib/situational/providers/opportunity-gap-candidate-provider.ts`) is the first genuine
  `LONG_TERM` candidate source backed by real evidence data — it adapts `getOpportunityGap()`
  (I-003, descriptive planned-vs-realised gap, never a debt score) rows with a meaningful positive
  gap (capped at the top 10 by gap size) into `isLongTermSignal: true` candidates. Wired into the
  existing `/api/insights/opportunity-gap` route (computed from rows that route already loads —
  no second query) and rendered as a compact "Situational summary" block above the existing table
  on the Opportunity Gap insights page. This route/page resolves a `LONG_TERM` situation (via
  `routeIntent: "INSIGHTS"`), proving genuine cross-page reuse of the same projection
  infrastructure Today uses, not a Today-only mechanism. **Architecture proof, verified two ways**:
  (1) an integration test evaluates the exact same candidate shape through the real compiled
  situation policy in both a `MATCHDAY` context (`SUPPRESS`, zero decisions) and a `LONG_TERM`
  context (`PROMOTE`, `LONG_TERM` horizon) —
  `opportunity-gap-candidate-provider.test.ts`; (2) the Opportunity Gap page itself only ever
  resolves `LONG_TERM` (an Insights route has no Matchday/Next operational meaning), so the
  suppression side is a policy-level guarantee proven by test, not something a coach would ever
  witness live on this particular page — an honest scope boundary, not a gap. **Privacy fix**: the
  candidate's `title` originally embedded the player's name (`"${playerName} — opportunity gap"`)
  — a violation of AGENTS.md's "Do not store player names inside ... decision records ... Use
  player IDs. Resolve names for display only," inconsistent with every other provider's candidates
  (which never carry a name). Fixed: the candidate title is now the generic `"Opportunity gap"`;
  `opportunity-gap-client.tsx` resolves the display name at render time from its own already-loaded
  `OpportunityGapRow[]`, matched via the decision's `affectedEntities` (`entityType: "PLAYER"`).

- **Opponent combination evidence — a second real `LONG_TERM` source**:
  `opponentCombinationEvidenceToCandidates()`
  (`src/lib/situational/providers/opponent-combination-candidate-provider.ts`) adapts
  `getOpponentCombinationEvidence()`'s factual, descriptive combination-evidence summaries
  (AGENTS.md "Combination evidence": "never a chemistry score") — excluding `INSUFFICIENT`
  confidence, capped at 8 — into candidates. Wired into the existing opponent detail page
  (`/opponents/{opponentTeamId}`), which already calls `getOpponentCombinationEvidence()` for its
  own `OpponentCombinationEvidenceSection` — no new query. This required a new
  `SituationRouteIntent` value, `"OPPONENT"`, and a `resolve-situation-context.ts` branch update
  (the opponent detail page has no notion of "today's matches," so it needed an explicit route
  intent to resolve `LONG_TERM` rather than falling through to the `NEXT` default). The candidate's
  primary entity is the opponent team (`entityType: "TEAM"`); every affected player id (a
  partnership/triangle can span 2+ players) surfaces via `affectedEntities` for display-time name
  resolution — this required extending `toCoachDecision()` in `get-coach-situation-projection.ts`
  to also map `candidate.affectedPlayerIds` into additional `affectedEntities` entries (previously
  only the single primary `entityType`/`entityId` pair was ever included), a small, additive,
  backward-compatible change verified with 3 new tests covering both the no-op case (every
  existing single-player candidate) and the new multi-player case. `OpponentCombinationSituationalSummary`
  (`src/components/opponents/`) renders the resulting decisions above the existing evidence
  section, resolving names from the page's own already-loaded player-name map — the candidate
  itself never carries a name. This page always resolves `LONG_TERM` (no `matches` fact is
  available there), proving the projection infrastructure is reused a third time beyond Today and
  Opportunity Gap.

- **Stalled live session (Phase 5 continuation)**: `createLiveSessionCandidateProvider()`
  (`src/lib/situational/providers/live-session-candidate-provider.ts`) detects an ACTIVE
  `LiveMatchSession` whose client hasn't sent a heartbeat (the reporting UI heartbeats every 30s
  while its tab is open) in `STALE_HEARTBEAT_MINUTES` (10) — a real signal ("did the coach walk
  away from live reporting without ending the session?") with no prior `AssistantWorkItem`
  category or UI surface. Reuses `AssistantCommandCentre.activeLiveSessions`, a new field added
  to the existing `liveMatchSession` query in `getAssistantCommandCentre()` (two extra selected
  columns, no new query) alongside `todayMatches`. Wired into Today alongside the other two
  providers. Note: "event readiness" was investigated as a candidate next provider and found
  already fully covered by the existing assistant-work-item provider (every `event_*`
  `AssistantWorkCategory` already has a `CATEGORY_CONSEQUENCES` mapping) — not rebuilt.

- **Situational annotation and reordering of Today's grouped sections (Phase 4 continuation)**:
  `computeDeferredWorkItemIds()` in `assistant-command-centre-page.tsx` marks a grouped-section
  item as "Lower priority right now" (a small, non-alarming annotation on its `WorkRow`) when the
  projection has decisions but this item's corresponding decision was not promoted — it is never
  hidden or removed, only annotated, consistent with AGENTS.md's requirement that Blocked/
  Decision-required signals always remain prominent. `sortByDeferred()` additionally reorders each
  group so non-deferred items render before deferred ones (a stable sort — items keep their
  original relative order within each bucket; nothing is ever dropped or duplicated). The
  "Blockers" and "Decisions" groups (`blocked_round`/`decision_required` categories) are
  explicitly excluded from both the annotation and any resulting reorder, since those categories
  have no corresponding situational candidate to compare against (the richer plan-integrity
  provider covers the same underlying signals with a different id scheme) — this is a deliberate
  correctness requirement, not an oversight.

**Not yet implemented** (tracked for follow-up work, not claimed as current behaviour):
- Candidate providers beyond the five above (report state beyond existing categories, live-match
  state beyond the stalled-heartbeat signal — `pending_profile_suggestions`, the opportunity-gap
  provider, and the opponent-combination-evidence provider are the only long-term-signal sources
  so far).
- Situational filtering of Today's metric-tile row (blocked/decision/review/report counts remain
  fully unfiltered by the projection — the grouped sections below them do carry annotation and
  reordering now, see above).
- `READY` vs. `LIVE` are now distinguished in the hero's empty-state copy (see "Explicit
  ready-state display" above). `REVIEW_AVAILABLE` and `ACTION_REQUIRED` are still not rendered as
  distinct explicit states anywhere beyond their effect on hero/decision content — no page shows
  a `projection.status` badge or label directly.
- Anything beyond the Matchday banner, Next-round-readiness, and opportunity-gap slices above:
  multiple imminent matches are not distinguished in the banner (only the first is shown),
  last-minute selection-change/lineup-gap content isn't surfaced in the banner itself (that still
  lives in the grouped sections below), simple NEXT decisions are not yet resolvable inline
  (navigation to the Round Board only — no safe command boundary has been wired for in-place
  resolution), the opportunity-gap summary is display-only with no deep-link interaction beyond
  what the existing table already offers, and there is no dedicated narrow-viewport Playwright
  spec beyond the existing accessibility project incidentally covering Today.
- Direct-action wiring beyond navigation (no in-place mutation actions yet), mobile Playwright
  coverage beyond the existing accessibility project, and the remaining quality gates in the
  programme bundle (full Phase 8 consolidation).

Do not treat any part of this document as describing the Round Board itself until this status
section is updated to say so — Today's hero "Next action" selection, the Matchday context banner,
the Next-round-readiness section, and the Opportunity Gap page's situational summary are the only
live situational UI;
the Round Board it deep-links to remains the pre-existing, unmodified deep-workspace page.

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

## Key files

| File | Purpose |
|------|---------|
| `src/lib/situational/situation-types.ts` | All type contracts: `SituationContext`, `CoachDecisionCandidate`, `DecisionCandidateProvider`, `CoachDecision`, `CoachSituationProjection` |
| `src/lib/situational/resolve-situation-context.ts` | Deterministic `resolveSituationContext()`; `MATCHDAY_IMMINENT_MINUTES` (kept identical to the Rego policy's own threshold) |
| `src/lib/situational/situation-policy-adapter.ts` | Typed adapter over `evaluatePolicyEntrypoint("situation", ...)`; `computeDegradedSituationResult()` safe fallback |
| `src/lib/situational/get-coach-situation-projection.ts` | The one projection query boundary: `getCoachSituationProjection()` / `projectCandidates()`, deterministic ordering, status computation |
| `src/lib/situational/providers/assistant-candidate-provider.ts` | Adapts existing `AssistantWorkItem`s into `CoachDecisionCandidate`s (`assistantWorkItemsToCandidates()`, `workItemIdFromCandidateId()`) |
| `src/lib/situational/providers/plan-integrity-candidate-provider.ts` | Adapts `computeRoundPlanIntegrity()`'s per-signal output into one candidate per signal (`createPlanIntegrityCandidateProvider()`, `planIntegritySignalToCandidate()`) — reuses already-computed `RoundPlanIntegrity`, never recomputes |
| `src/lib/situational/providers/opportunity-gap-candidate-provider.ts` | First real `LONG_TERM` candidate source: adapts `getOpportunityGap()` (I-003) rows with a meaningful gap into candidates (`opportunityGapRowsToCandidates()`) |
| `src/lib/situational/providers/live-session-candidate-provider.ts` | Detects a stalled `LiveMatchSession` (missed heartbeat) from already-loaded `AssistantCommandCentre.activeLiveSessions` (`createLiveSessionCandidateProvider()`, `staleLiveSessionsToCandidates()`) |
| `src/lib/situational/providers/opponent-combination-candidate-provider.ts` | Second real `LONG_TERM` source: adapts `getOpponentCombinationEvidence()` summaries into candidates (`opponentCombinationEvidenceToCandidates()`), never a synthesized score |
| `src/app/api/insights/opportunity-gap/route.ts` | Resolves a `LONG_TERM` situation and returns the projection alongside the existing `rows` payload |
| `src/app/(app)/insights/opportunity-gap/opportunity-gap-client.tsx` | Renders the "Situational summary" block from the route's `projection` |
| `src/app/(app)/o/[orgSlug]/opponents/[opponentTeamId]/page.tsx` | Resolves an `OPPONENT` route-intent `LONG_TERM` situation from already-loaded `combinationSummaries` — no new query |
| `src/components/opponents/opponent-combination-situational-summary.tsx` | Renders the resulting decisions, resolving player names from the page's own already-loaded map |
| `src/app/(app)/o/[orgSlug]/today/page.tsx` | Resolves the situation context and projection from already-loaded `AssistantCommandCentre` data, passes both to the page component |
| `src/components/assistant/assistant-command-centre-page.tsx` | `resolveNextAction()` (hero selection — no false fallback when the projection legitimately has zero decisions), `readyStateCopy()` (LIVE vs. READY empty-state wording), `MatchdayContextBanner` (Phase 5), `NextRoundReadinessSection` (Phase 6), `computeDeferredWorkItemIds()`/`sortByDeferred()` (Phase 4 continuation: grouped-section annotation + reordering) |

## Related

- ADR-0107 (architecture decision, includes the full division-of-responsibility rationale and the
  OPA/Rego standard-runtime change this depends on).
- `policies/packs/matchboard-default/rego/matchboard_situation.rego` /
  `matchboard_situation_test.rego` — implemented, tested situation policy source.
- `.matchboard-work/situational-decision-support/` (untracked, gitignored working bundle) — the
  full original programme specification this document and ADR-0107 were derived from.
