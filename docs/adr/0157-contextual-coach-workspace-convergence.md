# ADR-0157: Contextual coach workspace convergence

## Status

Accepted (programme — delivered incrementally, following ADR-0152/ADR-0155/ADR-0156's
precedent; see "Delivery" below).

## Context

A product-owner-authored specification
(`.matchboard-work/matchboard_contextual_coach_workspace/`, gitignored working bundle —
decisions normatively sourced from there, matching ADR-0152/ADR-0155/ADR-0156's own sourcing
precedent) asks Matchboard to converge from a collection of dashboards and secondary analysis
destinations into a **contextual coach workspace**: every piece of information lives where it
can change a coach decision, intelligence appears beside the decision it informs rather than on
a separate "AI"/"Insights"/"History" destination, and primary navigation shrinks from the
current five items (Today/League/Events/Players/More) to exactly four
(Today/League/Events/Players) once every job `More` currently owns has a verified contextual
destination.

The bundle's own numbering continues this repository's ADR sequence, originally expecting this
decision to land as ADR-0156; that number was already used by the Team Season Profile follow-up
(ADR-0156, merged immediately before this ADR was written), so this is ADR-0157 instead, per the
bundle's own documented fallback ("if ADR-0156 is already used when implementation starts, use
the next free ADR number without changing the substance").

### Prerequisite verified

ADR-0155 steps B7 (Assistant Coach capability) and B8 (hardening) are merged on `main`
(`f43280557`, `d129fb75b`) before this ADR and any application code for this programme. This
programme's Player Detail slice (C5) integrates with B7's hypothesis/assessment owner rather
than duplicating it.

### What already exists and must not be re-derived

Repository inspection (not the bundle's own file list alone) confirms the hard work this
programme recomposes already exists:

- **Situational decision support** (ADR-0107/ADR-0141/ADR-0142/ADR-0143): `src/lib/situational/*`
  and the `matchboard_situation.rego` policy already own Today's final relevance/priority
  ranking, `CoachDecisionCandidate`/`CoachDecision`, Live Now, Matchday phase logic, and the
  browser-local "since last visit" mechanism. This programme adds optional evidence-support
  metadata to these existing types; it does not replace the situational layer or add a second
  priority score.
- **Match Insights** (ADR-0149): `src/lib/matches/match-insights/*` already merges deterministic
  facts with optional AI enrichment into one ranked list (top five + Show all, semantic
  HIGH/MEDIUM/CONTEXTUAL relevance, no numeric score). This programme extends its fact coverage
  and adds opponent memory; it does not create a second Advisor surface.
- **Round Board** (`round-board-view-model.ts`/`round-board-production-adapter.ts`,
  `computeRoundPlanIntegrity()`): tap-first selection, the player-assignment inspector/sheet, the
  allocation matrix, and deterministic plan-integrity signals already exist. This programme
  replaces the standalone `RoundBoardAdvisorBlock` with a contextual rail fed by the same
  deterministic owners, after parity.
- **Canonical tactical positions** (ADR-0154): the 24-code vocabulary and 5x6 grid are complete
  and remain the only position vocabulary this programme's position-aware surfaces use.
- **Development context** (ADR-0155 B0-B8): `src/lib/development-context/*` already computes
  role exposure, game-state exposure, co-presence, and `DerivedTrend` rows, and ADR-0155 B7 owns
  the Assistant Coach hypothesis/assessment flow. This programme surfaces B6 trends and the B7
  hypothesis contextually; it does not recompute measurements in a React component or duplicate
  B7's persistence.
- **Coach learning loop** (ADR-0152): guided debrief, qualitative evidence, opponent memory,
  plan-versus-reality post-match Advisor roles, and weekly/development review are delivered.
  This programme reuses opponent memory and weekly-review recurring-theme facts for Season
  Review; it does not add a second recurring-theme algorithm.
- **Current primary navigation** (`docs/product/navigation-model.md`, UI/UX programme Phase
  2.4): five items — Today, League, Events, Players, More — with More as an analysis/admin hub
  (Insights, Season, History, Opponents, Groups, Formations, Rules, Settings, Reviews, and
  admin-only Simulation/Workbench). This programme's target supersedes that model; the
  five-item model remains live and documented as current until the final IA-convergence slice
  (C8).
- **Structural residue this programme must not touch**: ARR-0051 (`Selection` vs `MatchLineup`
  remain two intentionally distinct models — do not merge or add a third) and ARR-0052 (new
  realised-position reads use `ActualPositionInterval`, never a new consumer of
  `PostMatchPlayerActual.actualPositions`) are both still open and both explicitly preserved,
  not resolved, by this programme.
- **Known pre-existing defect this programme must correct before relying on it**:
  `src/lib/planned-rotation/rotation-vs-actual.ts`'s `getRotationVsActual()` currently
  initializes `minuteDeviations`' `plannedMinutes` to `0` — not a real projection. Completed
  Match's plan-vs-reality section (C6) must not render this as coach-facing truth until it is
  corrected to use `projectPlannedMinutesForSquad()` (or an equivalent canonical planned-minutes
  owner already used by `PlannedPlayingTimePanel`).

## Decision

### 1. Target information architecture

Primary navigation becomes exactly four items: **Today, League, Events, Players**. `More` is not
preserved as a destination — every job it currently owns (Insights, Season, History, Opponents,
Groups, Formations, Rules, Settings, Reviews, Simulation, Workbench, and other admin-only tools)
is either absorbed contextually into an owning surface, moved under Settings/administration, or
removed only once contextual parity is demonstrated. This is the final slice (C8) of the
programme, not an immediate change — slices C2-C7 build the contextual destinations first while
every legacy route stays operational, exactly mirroring the "additive, parity-before-removal"
discipline ADR-0152/ADR-0155's own multi-slice delivery already established for this repository.

Route disposition (full detail, `contracts/route-disposition.json`):

| Route | Target | Active primary nav |
|---|---|---|
| `/season` | Keep — reframed as Season Review, reached from League | League |
| `/opponents`, `/opponents/[id]` | Keep — contextual domain object | League |
| `/settings` | Keep and expand as the administration entry point | none (user/settings affordance) |
| `/groups`, `/rules` | Keep as Settings admin subroutes | discovered via Settings |
| `/formations` | Keep only until formation-library management is reachable from `MatchTacticsPanel`; then redirect | contextual (Match Tactics) |
| `/reviews` | Retire after peer-review initiation moves onto the reviewed object and due work moves onto Today | n/a |
| `/simulation`, `/workbench`, rebuild/backfill tools | Admin-only under Settings > Advanced | none |
| `/insights` | Retire after `11_INSIGHTS_ROUTE_DISPOSITION.md`'s contextual-parity map is satisfied, with redirects preserving selected-entity query params | n/a |
| `/history` | Retire after movement/history/export parity exists in Season/Player/Match/Opponent | n/a |
| `/more` | Delete/redirect last, once every job above has a verified destination | n/a |

### 2. Knowledge hierarchy — four visible semantic classes

Every statement shown to a coach is exactly one of:

1. **Fact** — canonical recorded state (score, attendance, actual minutes, selected squad).
2. **Deterministic evidence** — application-computed measurement from canonical facts
   (opportunity frequency, role exposure, co-presence, trend direction).
3. **Coach observation/assessment** — explicit human-authored or explicitly promoted judgement.
4. **Assistant Coach hypothesis** — optional AI synthesis citing Matchboard-owned evidence,
   never truth by itself.

The UI must not visually blur these four classes on any of the six surfaces this programme
touches.

### 3. Decision interaction model (unchanged, now shared everywhere)

The existing `DecisionInteraction` vocabulary (`INFORM` / `CONFIRM` / `CHOOSE` / `REVIEW` /
`AUTO`) remains authoritative across Today, Match Preparation, and Round Board. `AUTO` stays
prohibited for squad/player/lineup/opportunity/report/development decisions; a presentation path
that receives `AUTO` for one of these domains fails safe to `REVIEW`.

### 4. Shared decision/evidence contract (C1)

Add an **optional** evidence-support payload to the existing `CoachDecisionCandidate` /
`CoachDecision` types, propagated unchanged through to presentation. Normative shape:
`contracts/coach-decision-evidence-contract.ts`'s `DecisionEvidenceSupport` (maturity: `NONE |
EMERGING | ESTABLISHED | NOT_APPLICABLE`; coverage: `COMPLETE | PARTIAL | UNKNOWN |
NOT_APPLICABLE`; freshness: `CURRENT | AGING | STALE | NOT_APPLICABLE`; changeState: `NEW |
CHANGED | UNCHANGED | RESOLVED | NOT_APPLICABLE`; a bounded `sources` list keyed by
`DecisionEvidenceSourceKind`; free-text `caveats`).

This is presentation metadata only. The Rego policy is never given this payload as ranking
input, and no new numeric relevance/confidence score is introduced anywhere in the application —
Match Insights' existing semantic HIGH/MEDIUM/CONTEXTUAL relevance and the situational layer's
existing visibility/horizon/urgency model remain the only two relevance systems; this programme
does not add a third.

### 5. AI boundary (unchanged, restated for this programme's surfaces)

AI may synthesize supplied evidence, explain a deterministic recommendation, compare plan
expectation with reported reality, and propose a hypothesis/development observation requiring
explicit coach promotion. AI may never establish eligibility, rank destinations, invent position
suitability, decide confidence/maturity/situational relevance, create canonical evidence by
itself, or mutate selection/lineup/report/development/assessment state directly. When AI is
unavailable, every deterministic surface in this programme remains complete and useful; failure
is a small status state, never a page-level error.

### 6. Per-surface targets

Each surface keeps its current owning components/services (listed per-surface in
`13_COMPONENT_AND_FILE_MAP.md`, re-cited at the start of each slice's own PR) and is extended,
not replaced:

- **Today** (C2) — two compositions: a calm quiet-day state (next relevant football object only,
  compact readiness facts, a bounded "this week" chronology, at most one genuinely-due
  carry-forward item) and a decisive decision-day state (one dominant decision, its evidence
  disclosure, at most two secondary actionable items, at most one carry-forward item). No
  invented weather or training-session calendar. `InstallPwaCard` moves out of normal Today
  composition into Settings.
- **Match Preparation** (C3) — one before-match composition: identity/lifecycle, a compact
  opponent-memory block sourced only from existing encounter/observation/pattern/combination
  evidence, the existing single `MatchInsights` ranked list (extended with ADR-0155 development
  context facts where materially relevant), current plan/lineup, coaching intent. No second
  Advisor surface, no restored Partnership Evidence panel, no duplicate Lineup/Tactics tabs.
- **Round Board** (C4) — one contextual right rail (desktop) / sheet (mobile) with three modes
  (Insights / Balance / Development) replacing the standalone `RoundBoardAdvisorBlock` after
  parity. Balance shows facts, never a composite "team strength" score. Development context can
  inform but never validate an otherwise-ineligible move.
- **Player Detail** (C5) — keeps its five existing tabs (Overview, Matches, Development,
  Evidence, Manage). Overview gains a pure `selectPlayerCurrentStory()` headline (deterministic
  sources outrank AI; omitted when no material story exists). Evidence surfaces ADR-0155 B6
  trends from persisted data only. ADR-0155 B7 hypotheses appear clearly labelled and never
  outrank deterministic evidence or become the Overview headline without explicit coach
  promotion.
- **Completed Match** (C6) — read-only factual story: canonical event timeline, key figures (no
  possession/xG/momentum/Player-of-the-Match), corrected plan-vs-reality (minutes projection
  fixed per the defect above), factual score/event "Match flow" chronology (no momentum
  invention), coaching-intent review using existing post-match Advisor roles (no fabricated
  "Partially met" score), and a "What this match added" list gated on real, computed material
  change. Report/debrief mutation stays on the existing post-match report route.
- **Season Review** (C7) — story-first: three to five evidence-backed stories on Overview
  (Opportunity distribution, support/movement concentration, positional breadth, recurring
  team patterns, unresolved coaching themes — empty families omitted), with Teams / Players /
  Development / Opportunity as local (not global-nav) drill-down tabs absorbing the current
  `/insights` opportunity-family jobs and the `/history` player-matrix job. Season
  create/finalize/default-format administration moves to League season admin/settings, out of
  the narrative Review hero. Reached from League, never a fifth primary nav item.

### 7. Source-of-truth rules carried into every slice

- `Selection` = planned roster/role/eligibility; `MatchLineup` = starting slot/formation
  position (ARR-0051). Any new combined view surfaces a conflict rather than silently picking
  one as "who is playing".
- New realised-position reads use `ActualPositionInterval` (ARR-0052).
- Canonical tactical positions always resolve through ADR-0154.
- Co-presence (ADR-0155 `DerivedMeasurement`) is exposure-only language; `CombinationEvidence`'s
  own established-confidence football-combination semantics are a separate concept and the two
  are never merged into one "chemistry" statement.
- Presentation composes canonical owners; it does not recompute domain truth. No new read model
  introduces a per-row/per-player query loop (Today, Round Board, Season Review are named
  explicitly as prior regression risk).

## Explicit non-goals

No new database table (any proposed one is a stop condition requiring explicit architecture
review against this ADR — the programme is a read-model/composition convergence, not a new
domain). No player ranking, global player score, win probability, hidden quality score, or
causal claim from correlation. No player photo/crest upload. No weather or training-session
calendar data. No possession/xG/momentum metric. No spatial heat map before coordinate data
exists. No coach-operated match/round finalize action. No fake "Save"/"Finalize" control where
mutations already persist immediately. No second recurring-theme, combination, position, or
AI-queue/provider/fingerprint implementation anywhere this programme touches.

## Consequences

- Six existing surfaces (Today, Match Preparation, Round Board, Player Detail, Completed Match,
  Season Review) each gain bounded, extended read models and composition logic; none gains a new
  persistence model.
- Primary navigation eventually shrinks from five items to four, but only after C2-C7 each
  demonstrate contextual parity for the jobs they absorb — the five-item model and every legacy
  route remain fully operational throughout slices C0-C7.
- `RoundBoardAdvisorBlock`, the standalone `/insights` hub, `/history`, `/reviews`, and `/more`
  are retired, each only after its own explicit parity gate passes and (for API endpoints) a
  zero-remaining-consumer check.
- `getRotationVsActual()`'s planned-minutes defect must be fixed before Completed Match's
  plan-vs-reality section ships, correcting a real pre-existing gap rather than building new UI
  on top of a known-wrong `0` placeholder.

## Delivery

Delivered incrementally, one branch/PR per slice, sequentially:

- **C0** — this ADR, navigation/product doc updates describing the target state and staged
  migration. No application behaviour change.
- **C1** — shared decision/evidence support contract (optional metadata only; no Rego rewrite;
  current decision ordering regression-tested).
- **C2** — Today convergence (quiet-day/decision-day compositions, enriched deterministic Why?
  data, PWA install moved out; no nav change yet).
- **C3** — Match Preparation convergence (opponent memory, ranked-insights/current-plan
  hierarchy, ADR-0155 context where relevant).
- **C4** — Round Board contextual rail (Insights/Balance/Development; retire
  `RoundBoardAdvisorBlock` after parity).
- **C5** — Player Detail story and trends (Current story selector, B6 trends in Evidence, B7
  hypothesis integration without duplication).
- **C6** — Completed Match story (planned-minutes correction first, factual story, plan vs
  reality, match flow, coaching-intent review, what this match added).
- **C7** — Season Review (story-first Overview, Teams/Players/Development/Opportunity tabs,
  matrix/export as drill-down, season admin moved to League/admin, League entry point added).
- **C8** — Information architecture convergence (remove More from primary nav only after C2-C7
  acceptance gates pass; redirect Insights/History deep links per the disposition map; delete
  dead hub code/APIs only after a zero-consumer check).
- **C9** — Visual/quality hardening (UI-lab fixtures for the seven accepted golden states,
  accessibility, docs/screenshot updates, cleanup, full validation, final version
  classification).

### History

- 2026-10-06: Accepted. Repository inspection performed before writing this decision down
  confirmed the situational decision-support layer, Match Insights, Round Board's existing
  deterministic owners, ADR-0154's canonical positions, ADR-0155's development-context
  measurements/trends, and ADR-0152's coach-learning-loop evidence already cover the hard
  derivation work this programme recomposes — reflected in "What already exists and must not be
  re-derived" above. Numbered ADR-0157 rather than the bundle's own expected ADR-0156, which the
  Team Season Profile follow-up (ADR-0156) had already claimed immediately before this one was
  written — the bundle's own documented fallback for exactly this situation.
