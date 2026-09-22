# ADR-0149: Match Insights — consolidate Partnership Evidence and the before-match AI Advisor panel, rebalance the desktop Tactics layout

## Status

Accepted (2026-09-22). Fully implemented: all 6 delivery steps landed (ADR; deterministic domain
layer; `match_prep` context rebuild; server view-model; UI + layout rebalance; documentation/
feature-file migration). See "History" for the per-PR record.

## Context

An external implementation bundle
(`.matchboard-work/matchboard_match_insights_bundle/`, 8 numbered documents) specifies **Match
Insights**: a single coaching decision-support surface for the before-match planning experience,
combining deterministic Matchboard facts with optional bounded AI interpretation of those same
facts, ranked, shown top-5-by-default with a **Show all** expansion, and resilient to AI being
slow, unavailable, or stale. It also specifies shrinking the desktop pitch from roughly two-thirds
of the planning workspace to about 35-40%, giving Match Insights the larger share.

This bundle's own stated intent is to **replace two already-shipped, ADR-governed features**, both
confirmed present in this repository:

- **Partnership Evidence** — ADR-0094's `PlannedPartnershipEvidenceList` component (rendered
  inside `MatchTacticsPanel`, `src/components/matches/match-tactics-panel.tsx`), backed by
  `CombinationEvidence`/`getSeasonCombinationEvidence()`/`selectRelevantPartnerships()`
  (`src/lib/evidence/combination-aggregation.ts`).
- **The before-match "AI Advisor" panel** — ADR-0148's shipped contextual Advisor surface on the
  Match Details before-match `Overview` tab (`AdvisorPanel`/`AdvisorPanelStale`,
  `src/components/ai/advisor-panel.tsx`, driven by `getPlannedMatchAdvisorViewModel()`,
  `src/lib/ai/presentation/planned-match-advisor.ts`), showing the freshest of the `LINEUP_REVIEW`/
  `MATCH_PREP` capabilities' persisted insights.

ADR-0148 closes with: "any future material change to this architecture requires an ADR amendment
or supersession per this repository's ADR governance rules, not a silent deviation." Per
`docs/development/coding-agent-working-session.md`'s ADR gate, this qualifies as
architecture-affecting work (new domain service boundary, an AI context-builder rework, and
removal/consolidation of two shipped user-facing surfaces), so this ADR is written and accepted
**before** any application code changes, mirroring ADR-0148's own delivery precedent ("this ADR
lands with PR 1: ... no application code yet").

**The bundle's own file, schema, and layout assumptions were verified against the real repository
and found partly stale** before writing this decision (the bundle itself instructs verifying
rather than assuming): there is no separate "Tactics tab" — `MatchTacticsPanel` was folded
directly into the before-match `Overview` tab by ADR-0147's follow-up #11, and before-match tabs
are `Overview | Rotations | Opponent context | Notes`. The bundle's imagined AI output schema
(`category`/`relevance`/`confidence`/`factRefs`, per-capability) does not exist; the real, shared,
already-hardened wire contract (`src/lib/ai/contracts.ts`) is `kind` (`observation`/`attention`/
`opportunity`/`development_suggestion`) plus `subjectRef`/`secondarySubjectRef`/`evidenceRefs`/
`suggestedAction`, used identically by all five AI Advisor capabilities. This ADR's decisions are
grounded in the real implementation, not the bundle's assumptions.

## Decision

### 1. One surface replaces two, scoped to the before-match Overview tab only

`PlannedPartnershipEvidenceList` (nested under the pitch inside `MatchTacticsPanel`) and the
`AdvisorPanel`/`AdvisorPanelStale` block (stacked below the tab in `before-match-overview.tsx`)
are both removed from the before-match `Overview` tab and replaced by one new component family,
**Match Insights**.

This is a narrow, surgical consolidation, not a supersession of either governing ADR's broader
architecture:

- ADR-0094 (Combination Evidence) is **not** superseded. Its selection-engine bounded-signal
  scoring (`src/lib/selection/combination-scoring.ts`), the Round Board chip explanation
  (`explainCombinationEvidence()`), the post-match `MatchCombinationEvidencePanel`, and the
  opponent-detail `OpponentCombinationEvidenceSection` are all unaffected — `CombinationEvidence`
  and its aggregation services remain exactly as ADR-0094 describes them; only the standalone
  before-match planning-surface *list* is folded into Match Insights as one input among several.
- ADR-0148 (AI Advisor) is **not** superseded. The five-capability architecture, the credential
  custody boundary, the five provider adapters, dynamic model discovery, the job queue, retry
  policy, and — critically — the shared response contract and validation pipeline described below
  are all unaffected. Only the before-match Overview tab's *rendering* of `LINEUP_REVIEW`/
  `MATCH_PREP` insights changes, from a standalone bordered card to a component embedded inside
  Match Insights. The Round Board, post-match, and weekly-review Advisor surfaces are unaffected.

### 2. The AI wire contract is reused unchanged — no schema fork for this capability

`contracts.ts`'s shared `advisorResponseSchema`, `response-validation.ts`'s three-stage
ref/evidence validation, `runner.ts`'s claim/retry/failure-class machinery, and the
`AiAdvisorReview`/`AiAdvisorInsight` persistence model are reused **completely unchanged**. This
is a deliberate choice against forking a per-capability output schema (the bundle's own imagined
`category`/`relevance`/`factRefs` shape): the existing pipeline is shared, tested, and
production-hardened across all five capabilities, and forking it for one capability would be
materially more disruptive than necessary, contradicting the bundle's own "use the existing
provider abstraction and capability job architecture" requirement.

Instead, the bundle's richer presentation taxonomy (relevance classes, category families) is
produced **deterministically by Matchboard**, in the new domain layer (Decision 4), by inspecting
which `fact:` evidence-ref namespace an accepted AI insight cites — never by asking the AI to emit
a category/relevance field. The AI's job stays exactly what `contracts.ts` already allows: pick a
`kind`, write a grounded `title`/`body`, cite `evidenceRefs` that resolve in the context that
generated them.

`match_prep`'s existing `MAX_INSIGHTS = 10` shared cap (`contracts.ts`) is kept as-is — already
within the bundle's "12-15 suggested" range in spirit — rather than made capability-specific.
`match-prep.ts`'s own instructions move from "target 3 to 5" to "identify all materially useful
insights, do not pad the count, never exceed the schema's limit."

### 3. Bounded trusted opponent text becomes eligible for `match_prep` only

`match-prep.ts` currently excludes every free-text field by design
(`OpponentEncounterObservation.sportingLevelNote`/`.factualSummary`,
`PostMatchReport.teamNote`), per `06_AI_CAPABILITY_CONTRACTS.md`'s "no arbitrary free-text notes
in v1." This ADR creates one narrow, disclosed exception: for **prior encounters with the exact
same opponent only**, `OpponentEncounterObservation.factualSummary` and the corresponding
`PostMatchReport.teamNote` become eligible input, truncated to a documented bound, normalized, and
carried through the pipeline explicitly labeled as an attributed coach observation — never
represented as an objective fact, never merged into a numeric/structured field. Every other
capability's "no free text" rule, and `match_prep`'s own exclusion of `sportingLevelNote` (an
in-progress subjective note, not a settled post-encounter summary) and any note not tied to the
exact opponent, are unchanged.

### 4. New deterministic domain layer computes facts and baseline insights without AI

A new server-only module, `src/lib/matches/match-insights/`, becomes the authoritative source of
deterministic preparation facts and baseline insights — combination/partnership facts, exact-
opponent history (including the bounded trusted text from Decision 3), position/attribute/
development/season-statistics summaries, and a deterministic HIGH/MEDIUM/CONTEXTUAL relevance
ranking. It composes existing services (`getSeasonCombinationEvidence`,
`getOpponentCombinationEvidence`, `getPlayersActualPositionHistory`, `getPlayerAttributeAverages`,
`getActiveThreadsForPlayer`, `getPlayersSeasonOverview`) rather than reimplementing them, and
Match Insights remains fully usable with zero AI calls — the deterministic layer is not
downgraded functionality behind the AI layer, it is the baseline the AI layer enriches.
`match-prep.ts`'s context builder is rebuilt on top of this same domain layer instead of
re-deriving a narrower, partially-overlapping subset inline, so the facts a coach sees
deterministically and the facts the AI is grounded in are the same facts.

### 5. Desktop layout: the pitch's own grid is retargeted, not a new page-level grid

`MatchTacticsPanel`'s existing `grid gap-4 lg:grid-cols-[1fr_280px]` (the actual pitch-vs-sidebar
split per the real implementation — there is no single page-level grid spanning the whole
Overview tab) is retargeted to give the pitch roughly 35-40% and Match Insights roughly 60-65%,
with a `min-width` floor on the pitch column so it stays usable at intermediate desktop widths.
`TouchlineInspector` (currently the first item in the existing 280px sidebar, and already wider
than that column at 352px — a pre-existing overflow tension) moves to temporarily occupy the
Match Insights column when a player is selected, which is both the least disruptive option listed
in the bundle and a natural fix for that pre-existing width mismatch. Mobile/smartphone behavior
is verified independently and is not required to mirror the desktop ratio.

### 6. No schema or Prisma migration

Every fact this ADR's domain layer surfaces is computed on read from already-persisted data.
`AiAdvisorReview`/`AiAdvisorInsight` persistence is unchanged. No new tables, columns, or RLS
policies are introduced.

## Alternatives considered

### Fork a `match_prep`-specific AI response schema (category/relevance/confidence/factRefs)

- Benefits: matches the bundle's literal wording most closely; a richer wire-level taxonomy.
- Costs: touches `contracts.ts`, `response-validation.ts`, and `runner.ts` — shared infrastructure
  all five capabilities depend on — for the benefit of one capability; duplicates a taxonomy that
  can be derived deterministically from data Matchboard already controls (which `fact:` namespace
  an evidence ref belongs to).
- Reason not selected: contradicts the bundle's own "reuse the existing provider abstraction and
  capability job architecture" principle and this repository's preference for the least
  disruptive implementation; the deterministic-derivation approach gets the same coach-facing
  richness without widening the AI's authority or touching proven infrastructure.

### Drop `lineup_review` from the before-match Overview entirely, show only `match_prep`

- Benefits: a tighter scope match to the bundle's `MATCH_PREP`-only framing.
- Costs: discards `lineup_review`'s already-shipped, already-triggered content for this exact tab
  for no functional reason — a coach who just edited the line-up would lose feedback they
  currently get.
- Reason not selected: the "freshest of `LINEUP_REVIEW`/`MATCH_PREP`" selection already satisfies
  "no second AI panel" literally (one surface renders), so nothing forces discarding either
  capability's content.

## Consequences

### Positive

- One coherent before-match planning surface instead of three separate, uncoordinated ones
  (tactics pitch, partnership list, AI Advisor card).
- Match Insights degrades gracefully by construction — it is built on a deterministic layer that
  does not depend on AI, rather than an AI feature with a fallback bolted on.
- No new attack surface, no new secret-custody concerns, no schema migration — the highest-risk
  parts of ADR-0148's architecture are untouched.
- The desktop pitch's disproportionate width, a known pre-existing usability complaint, is fixed
  as a side effect of giving Match Insights room to exist.

### Negative

- `match-prep.ts`'s context grows materially richer, which means its normalized-context/fingerprint
  surface area grows too — more fields that must stay genuinely semantic (never UI state, never
  raw timestamps) for fingerprint reuse to keep working as designed. Mitigated by an explicit
  fingerprint audit in the PR that expands the context (Delivery, PR 3).
- The bounded trusted-text exception (Decision 3) is a real, if narrow, widening of what leaves
  Matchboard for this one capability. Mitigated by scoping it to exact-opponent-only prior
  encounters, truncation, and explicit attribution labeling; documented in
  `docs/domain/pii-inventory.md`.
- Six-plus sequential PRs is a meaningfully larger delivery than a single change; mitigated by
  following this repository's established sequential-PR convention (matching ADR-0148's own
  ~20-PR delivery), with each PR independently reviewable and revertible.

## Migration and compatibility

Purely additive at the schema level (no migration). At the UI level, this is a **breaking removal**
of two visible surfaces (Partnership Evidence list, standalone AI Advisor card) from one tab —
disclosed here rather than silent, per this ADR's own gate. `planned-partnership-evidence.tsx`'s
component is deleted only once confirmed fully unconsumed elsewhere (combination evidence itself,
and its other three surfaces, are unaffected and keep their own rendering paths). Rollback is
straightforward: revert the UI PR (Delivery, PR 5) to restore the two prior surfaces; the
deterministic domain layer and expanded `match-prep.ts` context are additive and harmless to leave
in place even if the UI PR is reverted.

## Security and operations

- No change to credential custody, provider adapters, or signing-key infrastructure (ADR-0148
  §1-3 untouched).
- Data minimization: the one net-new input class (Decision 3's bounded trusted text) is
  exact-opponent-scoped, truncated, and explicitly labeled as an attributed coach observation, not
  an objective fact — `docs/domain/pii-inventory.md`'s "External AI payloads" entry is updated to
  disclose it in the PR that implements it (Delivery, PR 3).
- Tenant isolation: the new domain layer reads exclusively through existing tenant-scoped services
  and ambient tenant context (matching ADR-0094's `combination-topology.ts`/
  `combination-aggregation.ts` precedent) — it introduces no new cross-tenant query path.
- No change to authorization: Match Insights is visible everywhere `MatchTacticsPanel`/the
  before-match Overview tab already is today; no new role or permission is introduced.

## Related records

- `.matchboard-work/matchboard_match_insights_bundle/` — the external product/UX/domain/AI-context/
  fingerprint/test/documentation-migration bundle this ADR's decisions are grounded against (not
  reproduced verbatim — several of its assumptions were corrected against the real implementation,
  as described in Context).
- ADR-0094 (Combination Evidence) — the before-match planning-surface *list* it shipped is folded
  into Match Insights by this ADR; every other surface/scoring use it describes is unaffected. Gets
  a short dated follow-up note once Delivery PR 5 lands, per this repository's existing precedent
  for this kind of note (e.g. ADR-0136 §19's follow-up), not a rewrite of ADR-0094's own history.
- ADR-0148 (AI Advisor) — this ADR amends only the before-match Overview tab's rendering choice for
  `LINEUP_REVIEW`/`MATCH_PREP` insights and `match_prep`'s own context/instructions; every other
  decision in ADR-0148 stands unchanged.
- ADR-0147 (Match Details and Post-Match Report lifecycle surfaces) — the before-match `Overview`
  tab composition and its ownership of `MatchTacticsPanel` are the surface this ADR's layout
  change (Decision 5) retargets; gets a short dated follow-up note once Delivery PR 5 lands, for
  the same reason as ADR-0094 above.

## Delivery

Implemented as a sequential series of PRs (one open at a time, per this repository's delivery
convention), matching ADR-0148's own precedent of one ADR amended with History entries as delivery
proceeds rather than one ADR per PR:

1. **This ADR only.** No application code.
2. Deterministic Match Insight domain layer (`src/lib/matches/match-insights/`), fully unit-tested,
   not yet wired to any route or UI.
3. `match-prep.ts` rebuilt on the domain layer (Decision 4), bounded trusted-text handling
   (Decision 3), fingerprint-input audit, `pii-inventory.md` update.
4. Match Insights server view-model merging deterministic insights with the current-fingerprint AI
   review's insights, status, and count.
5. UI: new Match Insights component family; removal of `PlannedPartnershipEvidenceList` and
   `AdvisorPanel`/`AdvisorPanelStale` from the before-match Overview tab; desktop layout retarget
   (Decision 5); mobile verification. ADR-0094/ADR-0147 follow-up notes land with this PR.
6. Documentation/feature-file migration and repository-wide cleanup of superseded terminology.

Every subsequent PR in this programme is governed by this ADR; a later PR that needs to materially
deviate from what is decided here amends or supersedes this ADR rather than silently contradicting
it, matching ADR-0148's own closing convention.

## History

- 2026-09-22: Created and accepted. No application code yet — this PR is the ADR only, per
  Delivery step 1.
- Delivery step 2 landed: the deterministic Match Insight domain layer
  (`src/lib/matches/match-insights/`) — fact/candidate types, per-player preparation summaries,
  combination/opponent/team-history context builders, deterministic relevance/category ranking,
  and gated fact-to-insight promotion. Not yet wired to any route or UI. No deviation from this
  ADR's decisions.
- Delivery step 3 landed: `match-prep.ts` rebuilt on the domain layer, with the bounded
  exact-opponent trusted-text exception (Decision 3) and a fingerprint-input audit (every new
  array explicitly sorted by ephemeral-ref key before serialization, since
  `computeSourceFingerprint()` canonicalizes object key order only, never array order).
  `docs/domain/pii-inventory.md` updated. No deviation from this ADR's decisions.
- Delivery step 4 landed: `getMatchInsights()` — the server view-model merging deterministic
  insights with the freshest `LINEUP_REVIEW`/`MATCH_PREP` review's insights (reusing
  `getPlannedMatchAdvisorViewModel()` unchanged, per Decision 5), plus
  `CURRENT`/`UPDATING`/`STALE_AI_WITHHELD`/`AI_UNAVAILABLE` status. AI insight category is derived
  from evidence-ref namespace (the same mechanism deterministic insights use); relevance is
  derived from `kind` alone (`ATTENTION`→HIGH, `OPPORTUNITY`/`DEVELOPMENT_SUGGESTION`→MEDIUM,
  `OBSERVATION`→CONTEXTUAL) — a disclosed, deliberate simplification of full fact-priority
  cross-referencing, not a correctness gap: every AI insight is already grounded via its required
  `evidenceRefs` regardless of tier. `build-current-plan-input.ts` extracted out of `match-prep.ts`
  as a shared, no-completeness-gate plan builder (deterministic insights must stay useful for a
  partial plan; `match-prep.ts` keeps its own AI-eligibility gate as a thin wrapper). No deviation
  from this ADR's decisions.
- Delivery step 5 landed: the Match Insights UI (`src/components/matches/match-insights/`) —
  `MatchInsights` (status line, top-5-by-default with an inline "Show all" expansion, no modal)
  and `MatchInsightCard` (relevance/category, observation/implication, an expandable evidence
  disclosure that never prints a raw evidence-ref string or database id). Self-fetched client-side
  by `MatchTacticsPanel` (`match-insights-actions.ts`, mirroring
  `getPlannedPartnershipEvidenceAction`'s existing pattern) and refreshed after every plan mutation
  — a page-load-time server prop would go stale immediately after an in-session lineup edit, so
  this reuses `MatchTacticsPanel`'s own established self-fetching architecture (already used for
  lineup/formation/the former partnership-evidence fetch) rather than prop-threading through
  `page.tsx`/`match-detail-shell.tsx`, which is why the now-superseded `advisorViewModel`
  prop-threading chain (page.tsx's `getPlannedMatchAdvisorViewModel()` call,
  `match-detail-shell.tsx`, `before-match-overview.tsx`) was removed outright rather than left
  dormant. `MatchTacticsPanel`'s pitch/sidebar grid retargeted per Decision 5/6 (Decision 6 above
  says "roughly `lg:grid-cols-[2fr_3fr]`" as the illustrative form; the shipped value is exactly
  that). `PlannedPartnershipEvidenceList` and `AdvisorPanel`/`AdvisorPanelStale` removed from the
  before-match Overview tab only — both remain live, unchanged on every other surface they already
  served (Rotations tab; Round Board, post-match, and weekly-review Advisor panels respectively).
  Dated follow-up notes added to ADR-0094 and ADR-0147. No deviation from this ADR's decisions.
- Delivery step 6 (final) landed: `features/matchboard.feature` rewritten for the retired "Tactics
  tab" scenario and a new "Match Insights is the single pre-match decision-support surface" Rule
  (ten scenarios drawn from `06_ACCEPTANCE_TESTS.md`, already covered by shipped code, not
  aspirational); `docs/agents/ux-and-terminology.md` and `docs/agents/security-privacy-and-
  tenancy.md` gained pointers; `README.md`'s privacy claim corrected for the Decision 3 trusted-
  text exception. A repository-wide search found no other stale references —
  `planned-partnership-evidence.tsx` is confirmed still live (Rotations tab) and was not removed.
  Programme complete; any future material change to this architecture requires an ADR amendment
  or supersession per this repository's ADR governance rules, not a silent deviation.
