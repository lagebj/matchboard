# Touchline Design Atlas — Data Provenance & Inventory (Phase 0)

**Programme:** Touchline Design Atlas & Composition Convergence
(`.matchboard-work/matchboard_touchline_design_atlas_implementation_followup_2026-09-11/`).
**Status:** Phase 0 (inventory + provenance) complete. Feeds Phase 1 (view models) and Phase 3
(route-complete UI Lab). This document is the reviewable provenance record required by
`03_DATA_PROVENANCE_AND_VIEW_MODELS.md §6` and the "conformance record" required per route by
`CODING_AGENT_PROMPT.md`.

Every field below is classified: `EXISTING_DIRECT`, `EXISTING_QUERYABLE`, `DERIVED_PRESENTATION`,
`CONDITIONAL`, or `PROHIBITED_ILLUSTRATIVE` (per `03_DATA_PROVENANCE_AND_VIEW_MODELS.md §1`).

## 0. Golden-reference corrections (resolved conflicts, per `01_GOLDEN_REFERENCE_ATLAS.md §4`)

These are the concrete places a golden image shows something that conflicts with an existing
durable rule or a missing data owner. Route-specific composition files win; recorded here once so
every route section below can just reference this list by number.

1. **Primary navigation stays 5 items (Today/League/Events/Players/More).** Every atlas board's
   sidebar/bottom-nav mockup shows more items (Rounds, Teams, Matches, Insights, History, Squad,
   etc. as siblings of Today). This directly contradicts AGENTS.md's "Canonical routes" §Phase 2.4
   IA decision, which is a documented product decision (existing domain/business invariant,
   authority tier 4), not a frontend styling choice (tier 5). **Resolution: keep the real 5-item
   nav; these routes stay reachable via League/More exactly as today.** This is the single most
   consequential resolved conflict in this bundle — flagged prominently rather than silently
   applied.
2. **No club/opponent logos or shields.** Golden images show team/opponent shield graphics
   Matchboard does not own (`01§3`). Use the existing neutral colour-circle-with-letter treatment
   (already established in `OperationalMatchCard`/`ScorebookMatchRow`/`TeamShield`-equivalent
   patterns) everywhere a shield appears in a golden.
3. **No W/D/L colour coding.** Goldens repeatedly colour outcome badges green/grey/red. ADR-0130's
   "result colour is neutral" rule (carried into Touchline) is a durable invariant: outcome text
   is secondary metadata, weight (not colour) distinguishes win/loss. Every scorebook/result row
   in this programme uses the existing `outcomeTint` weight-only pattern, never colour.
4. **No real geographic map widget** (Event detail). Use venue text only (`06§B`; confirmed no map
   capability/venue-coordinate data owner exists).
5. **No external/full league table anywhere** (Today, Teams overview). Matchboard has no
   standings-ownership for other clubs. Today's "Insights" slot and Teams overview both replace
   the illustrative standings with real Matchboard-owned data (`01§3`, `09§C`).
6. **No player photographs.** Player detail/Tactics inspector/Post-match use an identity tile
   (initials or shirt number), never a photo (`01§3`, `07§B`).
7. **No invented opponent "sporting-level percentage".** The real model is a categorical
   `SportingLevelConfidence` (`unknown|low|medium|high`) estimate, not a percentage bar. Use the
   category label only.
8. **No "shots"/"possessions"/"wide build-up creation rate"/"defensive transition concession
   rate" metrics.** Matchboard's live-match domain has no Shot event type and no possession
   tracking anywhere. The Insights golden's "Attacking involvement 42% of possessions end with a
   shot" and "Development opportunities" cards are `PROHIBITED_ILLUSTRATIVE` in full — see §7
   (Insights) below for the real replacement.
9. **No "Work rate"/"Style"/captaincy fields.** Confirmed absent from the `Player` model. Tactics
   inspector and Player detail use only real attributes (`ballControl, passing, firstTouch,
   oneVOneAttacking, positioning, oneVOneDefending, decisionMaking, effort, teamplay,
   concentration, speed, strength, goalkeeperAbility`) and `preferredFoot`/`bestSide` (both real).
10. **No accent-colour picker, no notification-preferences model.** Both confirmed absent from the
    codebase (`grep` returns zero hits). Settings' Appearance section stays System/Light/Dark only.
11. **No "cooperating clubs" concept** (Groups). Confirmed absent. Groups composition uses the
    real tab set (`Overview, Teams, Players, Guest players, Movement paths, Auto-select teams`).
12. **No rule "philosophy" radio selectors** (Rules). The golden's "Support priority: Performance
    and development / Equal playing opportunities / ..." and "Rotation paths: Rotate fairly /
    Ensure minimum matches / ..." are invented policy switches. The real Rules page has exactly:
    Rotation-path graph + cards + create form, and one Match Spacing config section
    (`minDaysBetweenAnyMatches`, `warningThreshold`). Squad size target/min/max and support
    priority rank are real but live on **Team configuration**, not Rules — composed there instead.
13. **No fictional event-day schedule items** ("Team meeting", "Warm-up", "Lunch break", "Team
    debrief"). Only real `EventMatch` rows exist as timeline entries.
14. **No literal "Preparation status 4/5 complete" checklist** unless every one of the N checks is
    independently, deterministically true/false from an existing state. Match detail mobile uses
    a small (2–3 item) real checklist (see §6) rather than force-fitting the golden's exact count.
15. **No marketing bullet list on the invitation page.** Use only real invitation facts:
    organisation name, intended role, invited email. No inviter name/group count (not selected by
    the current query — `CONDITIONAL`, could be added later, not fabricated now).
16. **No "Formation changed 4-3-3 → 4-2-3-1" literal review annotation** (Peer reviews). Not a
    stored `ReviewRequest` field (only `targetType`/`targetId`/`targetRevision`/messages exist).
    Use `requestMessage`/`reviewerComment` free text only.
17. **Team "Coaching intent" checklist → real `TeamFocus` free-text statements.** The golden shows
    a fixed 5-item checklist of aspirational sentences. Matchboard's real free-text coach-authored
    goal concept is `TeamFocus` (statement + context, max 3 active). Use real `TeamFocus` rows.

## 1. Today (`/o/[org]/today`)

**Production owner:** `AssistantCommandCentrePage` (server) → `getAssistantCommandCentre()`
(`src/lib/assistant/get-assistant-command-centre.ts`), plus `getWeeklyCoachingContext()`
(`src/lib/weekly/get-weekly-coaching-context.ts`) and `getCoachSituationProjection()`
(`src/lib/situational/get-coach-situation-projection.ts`).

| Field | Source | Class |
|---|---|---|
| Next/urgent match identity, kickoff, opponent, venue | `AssistantCommandCentre.todayMatches[]` / `MatchPresentation` | EXISTING_DIRECT |
| Blocking/decision-required counts | `RoundPlanIntegrity.summary.{blockerCount,decisionRequiredCount}` | EXISTING_DIRECT |
| Live session state | `AssistantCommandCentre.activeLiveSessions` / `TodayMatch.hasActiveLiveSession` | EXISTING_DIRECT |
| Attention items (max 4 + link) | `CoachSituationProjection.decisions[]` (visibility=PROMOTE/NORMAL) | EXISTING_DIRECT |
| Due decision reviews | `AssistantCommandCentre.dueDecisionReviews[]` | EXISTING_DIRECT |
| Squad status counts (Available/Doubtful/Unavailable) | `Player.currentAvailability` grouped by core team for the relevant round context | EXISTING_QUERYABLE |
| Recent football (last N results) | `MatchPresentation[]` from finalized/reported matches, own-team perspective | EXISTING_DIRECT |
| Today/this-week schedule | `AssistantCommandCentre.todayMatches` + `WeeklyCoachingContext.activity` | EXISTING_DIRECT |
| One evidence spotlight | `getTeamSeasonMatchPhasePatterns()` (opening/closing-phase goal pattern) — cheapest existing evidence family already used in the prior Touchline pass | EXISTING_QUERYABLE |
| External league table | — | PROHIBITED_ILLUSTRATIVE (§0.5) |
| "Create drill" quick action | — | PROHIBITED_ILLUSTRATIVE (no such domain action) |

## 2. League / Fixtures (`/o/[org]/fixtures`)

**Owner:** `getFixturesOverview()` (`src/domain/fixtures/service.ts`) → `FixturesOverview` (see
research above for full `FixturePeriod`/`FixtureRound`/`FixtureMatch` shape). All fields
EXISTING_DIRECT. Scorebook rows render via the existing `MatchPresentation` → `ScorebookMatchRow`
pipeline unchanged (§0.3 applies: no colour outcome coding).

## 3. History (`/o/[org]/history`)

**Owner today:** the page itself (`src/app/(app)/o/[orgSlug]/history/page.tsx`) — queries Prisma
directly (no shared lib function), builds `PlayerHistoryRow`/`MovementOverviewRow` inline.
**Better existing owner for the new composition:** `src/lib/selection/get-season-overview.ts`'s
`getSeasonPlayerRoundMatrix()` / `getMovementPathSummary()` / `getPlayerMovementTimeline()` —
these already have `coreMatches`/`supportMatches`/`developmentMatches`/`backfillMatches`
(exactly the "role usage" breakdown the spec wants) and full movement-path/timeline data, which
the *current* History page does not use at all.

| Field | Source | Class |
|---|---|---|
| Total finalized appearances | `PlayerRowSummary.totalSelections` (season-overview) | EXISTING_QUERYABLE |
| Core/support/development/squad-repair counts | `PlayerRowSummary.{coreMatches,supportMatches,developmentMatches,backfillMatches}` | EXISTING_QUERYABLE |
| Appearance distribution (min/median/max) | DERIVED from `PlayerRowSummary.totalSelections` across players | DERIVED_PRESENTATION |
| Movement trend by period | `MovementPathRow[]` / `MovementTimelineEntry[]` | EXISTING_QUERYABLE |
| Latest movement per player | `MovementTimelineEntry` (most recent) | EXISTING_QUERYABLE |
| W/D/L sequence, goals for/against | **No aggregator exists** — only per-match (`MatchPresentation`, `PlannedVsActualMatch`) | STOP — not built into the History view model; History stays a selection/movement history view per `05§C`'s own explicit instruction, not a match archive. A compact **secondary** recent-results cross-link may reuse `MatchPresentation` rows directly (already aggregated elsewhere), never as History's primary meaning. |
| "Review steps" / "How to read this page" explainer surfaces | current page | Removed from primary hierarchy per `05§C`; folded into one Help disclosure. |

## 4. Insights overview (`/o/[org]/insights`)

**Owner:** each evidence family already has its own function (see research). None expose a
narrative/interpretation string except short factual `message`/`detail` strings on policy
warnings/conflicts/operational health — no causal language anywhere, confirmed.

| Group | Primary story source | Class |
|---|---|---|
| Opportunity & load | `getOpportunityGap()` / `getLoadTimeline()` | EXISTING_QUERYABLE |
| Roles & development | `getPositionExposure()` / player pathways | EXISTING_QUERYABLE |
| Match patterns | `getTeamSeasonMatchPhasePatterns()` / `getPlayerCombinations()` | EXISTING_QUERYABLE |
| Planning quality | `getPlannedVsActualDeltas()` / `getPolicyWarningReview()` / `getConflictReview()` / `getOperationalHealth()` | EXISTING_QUERYABLE |
| "42% of possessions end with a shot" / "Development opportunities" (shots/wide-build-up/defensive-transition) | — | PROHIBITED_ILLUSTRATIVE — replaced by `getTeamSeasonMatchPhasePatterns()`'s real opening/closing-phase goal pattern for the "Match patterns" group's primary story. |

Confidence vocabulary used verbatim, never invented: `ConfidenceLevel` = `INSUFFICIENT|EMERGING|
ESTABLISHED` (combinations, tactical tendencies, match-phase patterns); `PositionExposureRow`
uses a plain `evidenceCompleteness` ratio (no confidence enum).

## 5. Players overview & detail

**Owner:** `getPlayersSeasonOverview()` / `getPlayersCurrentRoundAttention()`
(`src/lib/players/get-players-overview.ts` — NOT `get-season-overview.ts`, a distinct module).
Player detail: `getPlayerAllTimeStats`, `getPlayerCategoryStats`, `getPlayerRecentOpportunity`,
`getPlayerOutfieldRoleSuitability`, `getPlayerSelectionInvolvement`, plus `DevelopmentThread`/
`QuickObservation` rows. All EXISTING_DIRECT. `overallRating` (`getPlayerOverallRating`) exists
but per `07§A` must never be the primary ranking column — shown only as a secondary/inspector
fact if at all.

No dedicated "football observations for this player" list function was found wired into the
player-detail page load — `07§B`'s "latest observations" step is `CONDITIONAL`: shown only when
`DevelopmentThread.observations`/`QuickObservation` rows exist for that player, using exactly
those, never fabricated.

## 6. Events, Event detail, Event squad, Match detail, Lineup, Tactics, Rotations, Live Reporting,
Follow Live, Post-match

All shapes verified in the research above (`getEvents`/`getEventById`, `SquadBalanceSummary`,
`computeEventSquadFillPlan`, `EventMatchWithReport`, `getSupportCandidatesForEventMatch`,
`MatchData`/`SelectionRow` on match-detail, `TacticsBoard*` types, `classifyExactSuitability`/
`FIT_TIER_LABEL`, `PlannedRotationChange`/`generateRotationPlan`'s exact diagnostic strings,
`PostMatchReportViewModel`). All EXISTING_DIRECT or EXISTING_QUERYABLE.

Two exact diagnostic strings to reuse verbatim (never paraphrase):
- Rotation generator: `` `No safe replacement for ${role} at ${minutesLabel} min` ``
  (`generate-rotation-plan.ts`).
- Lineup suggestion: `` `No safe automatic fit for ${role}` `` (`suggest.ts`).

"Preparation status N/M" (Match detail mobile, §0.14): built from a small explicit set of real
booleans — squad populated (≥ minimum accepted size), lineup created, report status — not a fixed
5-step list matching the golden's exact count.

Event-day timeline items are `EventMatchWithReport` rows only (§0.13) — no meeting/warm-up/lunch
entries.

## 7. Opponents, Teams, Season

**Opponents:** `aggregateSportingLevel()` (categorical `unknown|low|medium|high`, never a
percentage — §0.7), `getOpponentTacticalTendencies()`/`getOpponentTendencyOutcomes()` (real
`OpponentPlayingStyleTag` enum, 17 real values), `OpponentEncounterObservation` fields
(`overallEnvironment`, `concernCategories`, `factualSummary`, `followUp`).

**Teams:** `getTeamsResultsOverview()` — real W-D-L/GF/GA/GD/clean-sheets/core-player-count per
team (confirms AGENTS.md; replaces the golden's external-standings table per §0.5). Team detail:
inline query in `teams/[teamId]/page.tsx` (roster, rotation paths, movement ledger, `TeamFocus`
rows — real free-text statements, replacing the golden's fixed checklist per §0.17).

**Season:** `getSeasonPlayerRoundMatrix()`, `getMovementPathSummary()`,
`getPlayerMovementTimeline()`, `getSeasonFairnessWarnings()`; `LeagueSeason` for identity/date
range/status (`OPEN|FINALIZED`); round completion from `roundCount`/`finalizedRoundCount`/
`draftRoundCount`. No external competition standings (§0.5).

## 8. Formations, Groups, Rules, Settings, More, Peer reviews, Invitation

All shapes verified above. Key corrections already folded into §0: no "Key focus" position tags
(Formations — use role type / exact target role / lane / automatic-planning eligibility only, per
spec, which is exactly what `deriveExactTargetRole()` + `FIT_TIER_LABEL` already provide); no
cooperating clubs (Groups); no philosophy radios (Rules); no accent picker/notifications
(Settings — real sections are Appearance/Details/Machine Principals/Danger Zone, plus **Team
configuration** reached contextually, not as a Settings tab, since it lives on the Team page); no
marketing bullets (Invitation — real fields are org name, intended role, invited email only).

Peer reviews: real `ReviewRequest` fields only (`targetType: EVENT_SQUAD|MATCH_LINEUP`, `status`,
`requestMessage`, `reviewerComment`, `resolvedAt`, superseded-by chain). `DecisionReview` is a
**separate** model (`targetType: DEVELOPMENT_THREAD|TEAM_FOCUS`) — never conflated with peer
reviews, per `10§F/§G`'s own instruction and confirmed structurally distinct in the schema.

## 9. Brand/PWA (Phase 8 — not built this session)

Existing mark: `public/brand/logo.svg` via `TouchlineMark`/`TouchlineBrandTile`. Existing sizes
already correct (192/512 android, maskable 192/512, apple 180, icon.png). Colour values from the
golden's brand board (Touchline Green `#C7F54A`, Near Black `#0B0F0A`, Light Neutral `#F4F6F3`,
Mid Neutral `#9CA3A0`, White) recorded for the Phase 8 pass; not implemented in this session — Phase
8 is gated behind Hard Gates A, B, and C, none of which have occurred yet.

## 10. Explicit blocked-widget register (bundle `00§5` stop conditions)

| Route | Requested illustrative content | Missing owner | Resolution |
|---|---|---|---|
| Today / Insights | External league table, "% of possessions end with a shot", "shots from wide build-up", "defensive transition concession rate" | No standings ownership; no possession/shot tracking anywhere in the live-match domain | Omit; Insights' "Match patterns" story uses `getTeamSeasonMatchPhasePatterns()` instead (real, already-evidenced). |
| All match/team/opponent/event headers | Club/opponent shield graphics | No logo/crest field on any model (confirmed via schema grep) | Neutral colour-circle-with-letter badge (existing pattern). |
| Tactics inspector, Player detail | Player photo, "Work rate", "Style", "Set as captain" | No photo storage, no such attribute fields, no captaincy field | Identity tile (initials/number); use only the 12 real numeric attributes + `preferredFoot`/`bestSide`. |
| Formations | Per-slot "Key focus" tags (Movement/Finishing/Composure) | No such field on `FormationSlot` | Show role type + exact derived target role + lane + eligibility meaning only. |
| Groups | "Cooperating clubs" count/tab | Confirmed absent from schema and codebase | Omit; keep the real 6-tab set. |
| Rules | Support-priority "philosophy" radios, rotation-path "policy" radios, availability-override toggles | None of these exist as configurable fields; `supportPriority` is a plain numeric rank on `Team`, not a philosophy enum | Use real numeric rank editor (on Team configuration) and the real rotation-path CRUD list; omit invented toggles. |
| Settings | Accent-colour picker, notification preference toggles, "Team configuration"/"About" tabs | Confirmed absent (grep); current page has exactly 4 sections | Keep Appearance (System/Light/Dark only) + Details + Machine Principals + Danger Zone; link out to Team configuration contextually rather than duplicating it here. |
| Peer reviews | "Formation changed 4-3-3 → 4-2-3-1" structured annotation | Not a stored field | Use `requestMessage`/`reviewerComment` free text only. |
| Invitation | Marketing feature bullets, inviter name, group count | Marketing bullets never existed; inviter/group data exists on the model but isn't selected by the current query | Omit bullets; inviter/group left `CONDITIONAL` for a future query change, not fabricated now. |
| Event detail | Real map/pin graphic, "Team meeting"/"Warm-up"/"Lunch break" schedule rows | No map capability; no generic schedule-item entity | Venue text only; timeline uses real `EventMatch` rows only. |

## 11. Navigation-scope decision (restated from §0.1)

**The 5-item primary nav (Today/League/Events/Players/More) is unchanged.** Every atlas-board
sidebar mockup is composition flavour for that specific mockup, not an instruction to expand the
IA. Routes named in the golden sidebars that are not primary items today (Rounds, Teams, Matches,
Opponents, Insights, History, Formations, Groups, Rules, Settings, Reviews) remain reachable via
League or More exactly as the current, deliberate Phase 2.4 IA decision specifies.
