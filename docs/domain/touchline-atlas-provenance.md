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

## 12. Hard Gate A review-feedback iteration (2026-09-11)

Human visual review of the Phase 3 UI Lab (`/dev/ui-lab/atlas`) surfaced two composition gaps,
fixed in this iteration:

- **`PitchExposure`/`PositionExposureWidget` had no pitch-line markings** — the mini-map rendered
  the `.tl-pitch-surface` background with no touchline/halfway-line/box markings, unlike every
  other pitch surface in the app. Fixed by exporting `PitchMarkings` from `TacticsBoard`
  (`src/components/formations/tactics-board.tsx`) — previously a private helper — and rendering
  it inside `PitchExposure`, matching this document's own "reuse, never duplicate a pitch"
  discipline (§0.9) rather than hand-drawing a second set of pitch lines.
- **The Tactics/Lineup/Formations golden panels show a slight perspective tilt and a
  goalkeeper/outfield kit distinction that the flat, neutral-toned production `TacticsBoard`
  rendering didn't have.** Two additive, low-risk fixes:
  - `PitchPlayerToken` gained an optional `kit?: "outfield" | "goalkeeper"` prop (default
    `"outfield"`) — not an invented per-team colour (which the component's own doc comment
    already correctly rules out), but the same real goalkeeper/outfield distinction
    `FormationSlotRoleType.GOALKEEPER` already carries as canonical data. `TacticsBoard` passes
    it automatically for every lineup/selection-preview token — this ships to every existing
    production consumer, since it is purely additive clarity with no interaction change.
  - `TacticsBoard` gained an optional `pitchStyle?: "flat" | "perspective"` prop, default
    `"flat"` — every existing production call site is therefore visually unchanged. The Atlas
    Tactics/Lineup/Formations route pages opt into `"perspective"`, a subtle
    `transform: perspective()/rotateX()` on the pitch-surface container. Because the transform
    moves the whole flat plane (background, markings, and player tokens) together as one rigid
    unit, no coordinate math (`getBoardPositionPercent`, slot click hit-testing, formation-builder
    add/edit) needed to change — this is presentation-only. Whether to flip the *default* to
    `"perspective"` for production Lineup/Tactics/Formations pages is a Phase 4 decision, not
    made here.
- `.tl-pitch-surface`'s own doc comment in `src/app/touchline.css` is updated to distinguish "no
  fake-3D stadium" (crowd/floodlights/rendered venue — still out of scope) from "a subtle CSS
  tilt is not" (now real, via `TacticsBoard`'s opt-in prop) — no shared-class behaviour changed,
  only the comment.

Full `npm run validate` (14/14 steps) passed after this iteration.

## 13. Hard Gate A review-feedback iteration, round 2 (2026-09-11)

Further human visual review surfaced two more gaps in the same review pass:

- **Player tokens didn't read as football "kits"** — the GK colour distinction (§12) was applied
  to a plain rounded-rectangle badge, which still didn't look like a shirt. `PitchPlayerToken`/
  `PitchEmptySlot` now render `lucide-react`'s `Shirt` icon (already an app dependency — no new
  icon pack, no generated image asset) as the token shape, filled/stroked by the same
  selected/kit/attention tone logic as before; the shirt number/role code sits on the "chest."
  This lands globally (no opt-in gate, unlike `pitchStyle`) since it is a strict visual
  improvement over the previous plain badge with no interaction or domain implication.
- **The golden Tactics/Lineup/Formations panels use a vertical (portrait) pitch, not
  horizontal** — own goal at the bottom, attacking direction bottom-to-top. `TacticsBoard` already
  supports `orientation="vertical"` (an established path — the earlier Touchline Finish UI Lab's
  `/dev/ui-lab/lineup` already exercises it) with no change needed to the component itself. The
  three Atlas route pages (Tactics/Lineup/Formations) now pass `orientation="vertical"` and cap
  the pitch container at `max-w-[380px]` so the taller portrait aspect ratio doesn't dominate a
  wide desktop layout — matching the golden's own bounded pitch proportions rather than stretching
  it to fill all available grid width.

Full `npm run validate` (14/14 steps) passed after this round too.

## 14. Phase 4 — Today production migration (2026-09-11)

First of the eight Phase 4 "High-identity routes." Migrates the real production
`(app)/o/[orgSlug]/today/page.tsx` + `AssistantCommandCentrePage` — not a UI-Lab copy — following
Hard Gate A approval. All existing situational logic (matchday banner, grouped work items,
decision-review section, next-round readiness, deferred-item annotation, "at a glance" metric
tiles, weekly coaching context, upcoming rounds, PWA install) is **frozen, unchanged** — this is
an additive composition change, not a rewrite of production behaviour.

**New, real (non-fixture) additions**:
- **Match hero** (`NextMatchHero`) — shown only when `resolveNextAction()` finds no decision
  urgent enough to force-feature (the existing, unchanged selection) *and* a real upcoming match
  exists (`resolveFeaturedUpcomingMatch()`, extracted to a shared helper so it's the same match
  `TodayOperationalTimeline` already marks NEXT — not a second, competing selection). Previously
  this exact state showed only a generic "Nothing urgent" empty state; the match itself was never
  shown as a hero anywhere on Today.
- **Squad status** (`SquadReadinessWidget`) — org-wide `Player.currentAvailability`
  (`getOrgActivePlayerAvailability()`, new, mirrors `getPlayersSeasonOverview()`'s existing
  active-player query shape), summarized via `summarizeSquadStatus()`. Fixed a real gap this
  surfaced: `TodayAvailability`/`AVAILABILITY_LABEL` was missing the `UNAVAILABLE` enum value
  (real production data, absent from the original UI-Lab-only type).
- **Latest matches** (`RecentFootballWidget`) — last 5 completed results org-wide, reusing
  `getFixturesOverview()`'s already-computed report state exactly like the League page does
  (no second results query).

**Built, then reverted before shipping — a real performance finding, not a design change of
mind**: an evidence-spotlight story (`EvidenceSpotlightWidget`, one factual "goals conceded in the
opening 10 minutes" count for the featured match's own team, via
`getTeamSeasonMatchPhasePatterns()`) was implemented, then removed after PR #522's CI
(`Deploy PR to Test slot`) failed twice with widespread 30s navigation timeouts, consistently and
only on pages that load Today. `getTeamSeasonMatchPhasePatterns()`'s own doc comment already
discloses "issues one goal-attribution query per completed match rather than a single batched
query — acceptable at the youth-league scale this product targets... flagged here for a future
optimisation pass if profiling ever shows otherwise." Wiring an unbatched per-match query into
Today — the single highest-traffic page, hit by every authenticated Playwright project
concurrently in CI — is exactly the profiling signal that comment anticipated. Rather than ship a
page that measurably slows under concurrent load, the evidence-spotlight addition (and its
supporting `buildEvidenceSpotlight()` helper, and the now-unused `evidenceSpotlight` prop on
`AssistantCommandCentrePage`) was removed before merge. This is a disclosed scope reduction driven
by real evidence, not a silent regression — reinstating it needs `getTeamSeasonMatchPhasePatterns()`
itself to batch its goal-attribution query first (the function's own documented follow-up), not
just re-adding the Today call site.

**Deliberately omitted, not silently dropped**:
- **External "League table"** — as documented in §0.5/§10, no standings model exists.
- **"Training" schedule row** — the golden's "17:30 Training · G2015 · Pitch 2" schedule item has
  no real data owner; this repository has no training-session model at all (confirmed by schema
  search). Added to the `PROHIBITED_ILLUSTRATIVE` register below.
- **A separate "Today's schedule" widget** — the golden's mixed training+match daily agenda
  concept, once the (illustrative) training row is removed, would only ever show the *same*
  matches `TodayOperationalTimeline` already renders, with strictly less functionality (no
  inline Follow-live/Complete-report actions, no live/next/later states). Building a second,
  weaker rendering of identical data was judged a regression, not an improvement, so it was not
  added — `TodayOperationalTimeline` (existing, unchanged) remains the one schedule/timeline
  surface.

**Extracted, not duplicated**: `todayMatchPresentation()` (Today-row match-presentation mapping)
moved from `assistant-command-centre-page.tsx` (a `"use client"` module) to a plain shared file,
`src/lib/matches/today-match-presentation.ts`, alongside the new `resolveFeaturedUpcomingMatch()`
helper — so the server page (which needs the identical mapping/selection to build the hero) and
the client component (which still needs it for the operational timeline) both call the one real
implementation, rather than a second copy living in a client-only module a server component
shouldn't import from for execution.

New `PROHIBITED_ILLUSTRATIVE` entry:

| Route | Requested illustrative content | Missing owner | Resolution |
|---|---|---|---|
| Today | "Training" schedule row (time + pitch) | No training-session model anywhere in the schema | Omit; schedule/timeline content stays real-match-only via the existing `TodayOperationalTimeline`. |

## 15. Phase 4 — League production migration (2026-09-11)

Second of the eight Phase 4 routes. The production `(app)/o/[orgSlug]/fixtures/page.tsx` +
`src/components/fixtures/fixtures-page.tsx` was already substantially Touchline-compliant (its own
golden, `touchline-v1-league-desktop.png`, is a Touchline Finish-era reference already
implemented faithfully — dense `ScorebookRoundSection`/`ScorebookMatchRow` rows, "Generate all
draft squads", the league-season selector). All of that — round/period generation, plan-integrity
counts, populate-all, the league-season selector — is **frozen, unchanged**.

**New, real addition**: the Atlas bundle's `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §B`
explicitly calls for "current/upcoming round as feature section" above the dense scorebook
history. `buildLeagueViewModel()` (already built, Phase 1) already computed a `featureRound`; this
pass wires it into real data via `toLeagueRoundInput()` (`FixtureRound` → `LeagueRoundInput`) and
renders it as a `WorkbenchToolbar` — round title + state + a prominent "Open Round Board →"
action — above the round list. The featured round still appears in its own normal scorebook
section below too (never removed from the list) — the same "shown twice, once as a shortcut"
pattern already used for Today's match hero.

`LeagueRoundInput.isCurrent` has no real backing field on `FixtureRound` (no round-level "is this
happening now" concept exists in this domain) — the adapter always passes `false`, honestly, and
`buildLeagueViewModel()`'s "first non-finalized round" fallback still resolves the feature round
correctly without it.

**Deliberately omitted**: the spec's "optional 3-column support rail only for current planning
attention" — the existing per-round summary line already surfaces blocker/decision counts inline;
a separate rail would duplicate that, not add new information, so it wasn't built (optional per
the spec's own wording).

**Real bug found and fixed while wiring real data**: `buildLeagueViewModel()`'s original fallback
chain ended in an unconditional `rounds[0]`, which — when every round in a period was already
`FINALIZED` — would still "feature" the first round as if it needed action, misleadingly
presenting a finished round as current/upcoming. This never surfaced in the UI-Lab fixture (which
always included a non-finalized round) or existing tests (none covered the all-finalized case). A
new regression test (`league-view-model.test.ts`) locks in the fix: featureRound is `null` when
every round is finalized.

Verified: full `npm run validate` (14/14), all pre-existing `FixturesPage`/`buildLeagueViewModel`
tests updated for the intentional "shown twice" duplication and passing, 3 new tests (2 for the
feature-toolbar behaviour, 1 regression for the all-finalized bug), and a real screenshot against
the seeded Fjordvik FK dataset.

## 16. Phase 4 — Events production migration (2026-09-11)

Third of the eight Phase 4 routes. Both the production `(app)/o/[orgSlug]/events/page.tsx`
(Events list) and `(app)/events/[eventId]/event-detail.tsx` (Event detail, via
`components/events/event-detail.tsx`'s `EventDetail` client component) — not UI-Lab copies. All
existing squad generation, fill/regenerate, guest-player, availability, match, and finalization
behaviour is **frozen, unchanged**. Unlike Today and League, Event detail already had substantial
pre-existing Atlas-shaped composition from an earlier phase (`EventDayTimeline` leading the
Overview tab per ADR-0125, plus a `MetricTile` row and an "Event details" facts panel) — this pass
adds only the pieces genuinely missing, not a rebuild.

**Events list — new**: a "Next event" feature widget above the existing month-grouped
upcoming/past lists, wired from the already-built `buildEventListViewModel()`
(`src/lib/touchline/presentation/event-view-model.ts`, Phase 1) into real `getEvents()` data for
the first time. The featured event still also appears normally in its month group below — the
same "shown twice, once as a shortcut" pattern Today's hero and League's toolbar already
established. The mapping from a real event row to the view model's `EventListRowInput` was
extracted to a new pure module, `src/lib/events/event-list-presentation.ts`
(`toEventListRowInput()`, `readinessLabel()` — the exact pre-existing readiness rule, reused
verbatim, not re-derived), so it is directly unit-tested without needing to render the async
Server Component page — the same extraction discipline `today-match-presentation.ts` established.

**Event detail — new**: a `SquadReadinessWidget` (Phase 2) rendered on the Overview tab, directly
below the existing `EventDayTimeline`. Computed entirely from `data.squads` — already loaded by
the existing page query, no new query added. `available`/`unavailable` map to
assigned/missing-from-target counts and `exceptions` lists squads short of their target, exactly
mirroring the UI-Lab reference composition at `/dev/ui-lab/atlas/routes/event-detail`. Extracted
to `src/lib/events/event-squad-readiness.ts` (`computeEventSquadReadiness()`) for the same
unit-testability reason as the Events list adapter above — `event-detail.tsx` is a large
`"use client"` component with a substantial server-action surface, not a convenient place to unit
test a pure computation directly.

**Deliberately deferred, not silently dropped** (a real, disclosed scope reduction — same
discipline as Today's evidence-spotlight removal):
- **`opponentSummary` on the Events list** is always `null`. `getEvents()` loads squads/players
  per event, not per-event match/opponent rows; deriving a real opponent summary would need either
  a new per-event query (an N+1 risk across the whole list, the exact category of issue that
  slowed Today under CI load) or a broader change to `getEvents()`'s own query shape. Left for a
  future pass once there's a batched way to get it.
- **The Event-detail "Next match" and "Helpers" widgets** shown in the UI-Lab reference
  (`/dev/ui-lab/atlas/routes/event-detail`) were not built in this pass. "Next match" needs a
  per-event-match query the current `EventDetailData` does not load (Event matches have no
  `MatchPresentation` equivalent — a separate `EventMatch` model, per the UI-Lab route's own doc
  comment) and is already well covered by the existing, frozen `EventDayTimeline`. "Helpers"
  needs a genuinely new cross-match aggregation over `EventMatchSupportAssignment` that nothing on
  this page currently loads. Both are real, addressable follow-ups, not abandoned — deferred here
  specifically to keep this PR's new-query surface at zero, after the Today CI-performance lesson.

Verified: full `npm run validate` (14/14), 9 new unit tests across the two new pure modules
(`event-list-presentation.test.ts`, `event-squad-readiness.test.ts`), and a real screenshot
(Events list + Event detail, desktop + mobile) captured against the seeded Fjordvik FK dataset via
the existing test-agent auth flow.

## 17. Phase 4 follow-up — Today "Latest matches" performance fix (2026-09-12)

A real, measured regression found and fixed after Today's migration (§14) merged: PR #522's
"Deploy PR to Test slot" acceptance job (not a required merge check, but a genuine E2E signal)
failed identically three times — `page.goto` exceeding a 30s timeout on `/today`, across 13 of
the same Playwright tests each time — even after removing the evidence-spotlight story (§14's own
disclosed reduction). League's PR (#523), whose own new code added zero queries, failed
**identically** on a completely fresh (non-reused) per-PR Neon branch, ruling out "accumulated
test data on a reused branch" as the cause. The one thing every failing deploy has in common:
Today's page (merged into `main` since #522) unconditionally calls `getFixturesOverview()` for its
"Latest matches" widget.

`getFixturesOverview()` (`src/domain/fixtures/service.ts`) loads **every** `Season` →
`LeagueSeason` → `MatchRound` → `Match` row for the organisation, unbounded, plus a batched
selection/report/live-session query across every resulting match ID — the correct, appropriate
cost for League's own page, visited deliberately once per League-planning session. Today is very
likely the single highest-traffic page in the whole app (the default post-login landing surface,
and the target of the situational-decision-support redirect) — calling that same unbounded
whole-season query from Today as well roughly doubles its total cost across every concurrent
request the Playwright suite fires, which is exactly what pushed some requests over the 30s
navigation timeout under CI's concurrent multi-project load.

**Fix**: a new, deliberately narrow, bounded query — `getRecentCompletedMatches()`
(`src/lib/matches/get-recent-completed-matches.ts`) — replaces `getFixturesOverview()` on Today.
It queries only the `limit * 3` most-recently-kicked-off, non-cancelled matches org-wide (using
the existing `[startsAt, createdAt]` index), then looks up which of those have a REPORTED/LOCKED
`PostMatchReport` (there is no Prisma relation between `Match` and `PostMatchReport` to join
directly — `getFixturesOverview()` itself does the same two-step lookup, just after first loading
the entire season tree). No season/round tree is loaded at all. `deriveMatchLifecycleStatus()` is
reused unchanged for lifecycle correctness — since every result already carries a REPORTED/LOCKED
report and a non-CANCELLED match status, its `isLive`/`hasPassed`/`roundStatus`/`planningClosedAt`
branches are provably unreached, so those params are passed as documented placeholders rather than
threaded through a second, redundant query.

This is a correctness-preserving performance fix, not a behaviour change — Today's "Latest
matches" widget shows the exact same data (the last 5 completed matches, own-team perspective),
just computed far more cheaply. Locked in with 5 new DB-backed tests
(`get-recent-completed-matches.test.ts`): empty when nothing is reported, DRAFT reports excluded,
own-team goals/outcome computed from the HOME/AWAY perspective correctly, the `limit` parameter
respected, and organisation isolation (never returns another org's matches).

Verified: full `npm run validate` (14/14), 5 new tests, all pre-existing tests (including
`today-match-presentation.test.ts` and the `AssistantCommandCentrePage` component tests) passing
unchanged.

## 18. Phase 4 follow-up — Today squad status placement fix (2026-09-12)

A second real placement bug found while capturing verification screenshots for §14/§17
(not a design change of mind — a genuine visibility gap the original migration shipped with):
`SquadReadinessWidget` was nested *inside* Today's `featuredMatch` branch — the "no urgent
decision, but a real upcoming match exists" case — rather than rendered independently of which
hero branch is active. Since `nextAction` (a real work item exists) is the *more* common case for
an active coach — arguably the more important case, since it's exactly when a coach most wants
standing squad-availability context — squad status almost never actually appeared in practice.
Screenshotting the real seeded dataset (which has an active `nextAction`, "Fjord Cup: lineup
needed") immediately surfaced this: no squad status widget anywhere on the page.

**Fix**: `SquadReadinessWidget` moved out of the `featuredMatch` grid and into the same
unconditional block as `RecentFootballWidget` (both real, always-independent Touchline Design
Atlas additions) — rendered whenever either has data, regardless of which of `nextAction` /
`featuredMatch` / the empty state is showing as the hero above. `NextMatchHero` reverted to full
width in its own branch, matching its shape before combining with the widget.

Locked in with a new regression test on `AssistantCommandCentrePage`: squad status and recent
matches both render when a real `nextAction` work item is present (previously they would not).
Verified: full `npm run validate` (14/14), the new regression test plus all 26 pre-existing
component tests passing unchanged, and a real screenshot against the seeded Fjordvik FK dataset
confirming the widget now renders alongside the existing "Fjord Cup: lineup needed" hero.

## 19. Phase 4 — Match detail production migration (2026-09-12)

Fourth of the eight Phase 4 routes. The production `(app)/o/[orgSlug]/matches/[matchId]/page.tsx`
+ `components/matches/match-detail.tsx`'s `MatchDetail` client component — not a UI-Lab copy.
Scope is deliberately narrow, per the bundle's own phase note: **top-level match identity/header/
summary composition only.** Every existing tab (Squad, Tactics, Rotations, After match, Opponent
context, Review) and every mutation inside them (selection editing, absence control, matchday
responsibility, helpers, guest players, lineup/tactics/rotation planning, live reporting,
post-match reporting) is **frozen, completely untouched** — those are Phase 5 scope, not this
route's.

**New, additive, in the header area only (before the existing `TabRail`)**:
- A **Squad** widget — `{core, support, development, matchday}` counts, computed entirely from
  `match.selections` (already loaded by the existing page query) via a new pure function,
  `computeMatchSquadBalance()` (`src/lib/matches/get-match-squad-balance.ts`). Legacy `BACKFILL`
  rows bucket with `SUPPORT` (new generation never produces `BACKFILL`, AGENTS.md "Squad repair
  rules"); the synthetic `"HELPER"` role match-detail.tsx already assigns to
  `MatchHelperAssignment` rows (not real `Selection` rows) buckets as `matchday`.
- A **Preparation** checklist — three real booleans (`squad`/`lineup`/`report`), never an
  invented fixed count. `squad`/`report` come from data the page already loads
  (`selections.length > 0`, `postMatchStatus` in REPORTED/LOCKED). `lineup` needed one new,
  deliberately narrow, single-row existence check (`db.matchLineup.findFirst({ where: { matchId
  }, select: { id: true } })`) — not the unbounded-tree class of query that caused the Today
  regression (§17); lineup *content* is never read or rendered here.
- A **Planning attention** widget — the single highest-priority existing warning (from
  `match.warnings`, already loaded; the same `blockingWarnings`/`requiresOverrideWarnings` arrays
  the Squad tab's own banners already use), shown only when one exists. Reuses the existing
  `formatWarningCode()` formatter — no new wording invented.

All three are assembled by one new pure function, `buildMatchPlanningHubViewModel()`
(`src/lib/matches/get-match-planning-hub-view-model.ts`), which itself calls the already-built-but-
previously-untested `buildMatchViewModel()` (`src/lib/touchline/presentation/match-view-model.ts`,
Phase 1) — closing a real, disclosed gap found while starting this work: that module (and 4 of
its 15 view-model-module siblings) had never actually had a unit test written, unlike the 6
modules already wired into Today/League/Events. Added now that it has a real caller: 7 new tests
(`match-view-model.test.ts`).

**Deliberately deferred, not silently dropped**: the UI-Lab reference's "Availability" widget
(per-selected-player `currentAvailability`, available/doubtful/unavailable) needs the existing
`selections` query's `player: { select: {...} } }` widened by one field and `MatchData`'s type
threaded through — a real, low-risk change, but this pass kept its new-query/new-field surface to
the single lineup-existence check above, matching the "prefer zero new queries" discipline learned
from §17. A future pass can add it directly onto the same `matchViewModel` assembly.

Verified: full `npm run validate` (14/14), 7 new tests for `buildMatchViewModel()`
(previously-missing coverage), 4 new tests for `computeMatchSquadBalance()`, 6 new tests for
`buildMatchPlanningHubViewModel()` (17 new tests total), and a real screenshot (desktop + mobile)
against the seeded Fjordvik FK dataset confirming the Squad (10 planned: 8 Core / 2 Support) and
Preparation (1/3 complete) widgets render correctly above the unchanged Squad tab.

## 20. Phase 4 — Players production migration (2026-09-12)

Fifth of the eight Phase 4 routes. Unlike the previous four, this pass concludes with a
**deliberately small, disclosed change** — the production Players list and Player detail pages
were found, on inspection, to already substantially satisfy the Atlas composition intent from
earlier work, and forcing a literal rebuild of what the UI-Lab reference shows would have meant
duplicating existing, working UX rather than extending it (the "widget/viz library extends, not
duplicates" principle, ADR-0136 Decision §3, applies just as much to whole-panel composition as
to individual widgets).

**Players list — no change, documented as already covered.** The UI-Lab reference
(`/dev/ui-lab/atlas/routes/players`) shows a dense roster table plus a "selected-player inspector"
side panel. The real production `SeasonOverviewTable` (`src/components/players/season-overview-table.tsx`)
already has an equivalent concept: clicking a row expands it inline to show per-round movement
detail (`expandedPlayer` state, `renderMovement(row)`) — the same underlying data
(`PlayerSeasonOverviewRow`, already loaded, already rich: `actualAppearances`/`goals`/`assists`/
`coreAppearances`/`supportAppearances`/`developmentAppearances`/`recentInvolvement`/
`roundAssignments`), just as an inline expansion rather than a side panel. Building a second,
competing side-panel inspector for the exact same information would be genuine UX duplication, not
an improvement — so it was not built. `player-list-view-model.ts` (Phase 1) stays UI-Lab-only for
now; it had no unit test despite `player-detail-view-model.ts` (its sibling) having one — closed
with 3 new tests, matching the same "close a disclosed test-coverage gap found along the way"
discipline as `match-view-model.ts` in §19.

**Player detail — one small, real, additive change.** The production page
(`(app)/o/[orgSlug]/players/[playerId]/page.tsx` + its ~15 existing panels) already independently
satisfies most of the bundle spec's `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §B` ordered list:
identity (`PlayerProfileHeader`), the "OpportunityWidget"/"PositionExposureWidget" concepts
(`PlayerEvidenceStoriesPanel`'s `recentOpportunity`/`realisedPositionCounts`, built under
ADR-0125's evidence-viz system before this bundle existed), development focus
(`PlayerDevelopmentThreadsPanel`), latest observations (`PlayerQuickObservationsPanel`), and recent
football (`PlayerCurrentInvolvementPanel`). Two items were genuinely missing:
- **Participation summary strip** (spec item 3) — a compact headline row (Played/Goals/Assists/
  Planned absent) directly below the header, using the exact same already-computed
  `getPlayerAllTimeStats()` result the existing `PlayerStatsSummaryTable` shows in full further
  down the page — zero new query, not a competing source, just a different level of detail for
  the same fact. Built via a new pure function, `buildPlayerParticipationSummary()`
  (`src/lib/players/get-player-participation-summary.ts`), rendered with the existing
  `MetricStrip` widget primitive (Phase 2).
- **Tabbed Overview/Matches/Development/Evidence structure** (spec item 2) — **deliberately
  deferred, not built.** Restructuring an already-working, extensively-tested, heavily-interactive
  page (readiness signals, development threads, quick observations, and multiple inline-editable
  fields, each with its own server action) into tabs is a genuine page-hierarchy decision with real
  regression risk, disproportionate to every other Phase 4 change so far, which have each been a
  small, additive, low-risk delta on top of frozen existing behaviour. A future dedicated pass
  (with its own review) is the appropriate place for this, not folded into this route's turn.

Verified: full `npm run validate` (14/14), 2 new tests for `buildPlayerParticipationSummary()`, 3
new tests for `player-list-view-model.ts` (closing its coverage gap), and real screenshots (desktop
+ mobile) against the seeded Fjordvik FK dataset confirming the participation strip (0 Played / 0
Goals / 0 Assists / 0 Planned absent for the captured player) renders correctly below the header,
with every existing panel below it unchanged.

## 21. Phase 4 — Insights production migration, completing Phase 4 (2026-09-12)

Sixth and final of the eight named Phase 4 "High-identity routes" (Events and Player detail were
each folded into one PR alongside their list page, per §16/§20 above — this is the last remaining
distinct route). The production Insights hub (`(app)/insights/insights-client.tsx`, rendered via
`(app)/o/[orgSlug]/insights/page.tsx`) — not a UI-Lab copy.

The hub was found, on inspection, to be exactly the anti-pattern
`07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §C` explicitly warns against: "Do not create a metrics
dashboard of equal cards." It had **two** instances of this — a flat 4-tile `SummaryCard` grid
(`playersWithNoOpportunity`/`playersWithHighLoad`/`matchesWithMissingReports`/
`policyWarningsCount`, all visually equal) sitting above a flat, ungrouped list of 13 surface
cards, with no narrative structure at all.

**Fix**: the spec's own four named sections — Opportunity & load / Roles & development / Match
patterns / Planning quality — implemented as a new pure grouping module,
`src/lib/insights/get-insights-hub-groups.ts` (`INSIGHT_CARDS`, `groupInsightCards()`,
`getGroupSpotlightValue()`). Card → group assignment follows the spec's own "primary from" lists
verbatim (e.g. Player Combinations belongs to Match patterns, not Roles & development, even though
both are "player-relationship" surfaces — the spec is explicit). The flat 4-tile `SummaryCard`
grid was removed entirely (fixing the second instance of the exact anti-pattern) — two of its four
numbers (`playersWithNoOpportunity`, `policyWarningsCount`) now surface as a single
`EvidenceSpotlightWidget` headline per group instead, reusing the exact same already-fetched
`/api/insights/overview` response (**zero new query**). "Roles & development" and "Match patterns"
have no existing `InsightOverview` field that maps to their theme — `getGroupSpotlightValue()`
returns `null` for those rather than fabricating a number; the two remaining unmapped numbers
(`playersWithHighLoad`, `matchesWithMissingReports`) are not lost — they remain fully visible on
their own dedicated Insights sub-pages, just not summarized twice at the hub.

**Real, disclosed bug found and fixed along the way**: `/insights/player-pathways` — a fully-built,
canonical-routes-table-documented Insights surface (AGENTS.md: "Player Pathways — season matrix,
context transitions, fairness overview") — was **entirely absent from the hub's card list**,
unreachable from Insights navigation. Added as the 14th card, grouped under "Roles & development"
per the spec's own "pathways" source — closing a real, pre-existing navigation gap, not a Touchline
addition.

Verified: full `npm run validate` (14/14), 9 new tests (`get-insights-hub-groups.test.ts`) covering
grouping completeness (every card lands in exactly one group, none dropped), the specific
Combinations-vs-Roles assignment, and both spotlight mappings including singular/plural phrasing,
and real screenshots (desktop + mobile) against the seeded Fjordvik FK dataset confirming all four
sections render with their correct cards and headline numbers.

**Phase 4 is now complete — all 8 named routes migrated** (Today §14, League §15, Events + Event
detail §16, Match detail §19, Players + Player detail §20, Insights §21), plus three real
follow-up fixes discovered and resolved along the way (§17, §18, and the player-pathways gap
above). Per ADR-0136/`13_IMPLEMENTATION_PHASES_AND_GATES.md`, Phase 4 stops here for **Human Gate
B** — Phase 5 (Round Board, Lineup, Tactics, Rotations, Live Reporting, Follow Live, Post-match)
does not begin without a fresh, explicit human approval.

## 22. Phase 5 — Round Board production migration, first of the football work surfaces (2026-09-12)

First of the seven Phase 5 routes (`13_IMPLEMENTATION_PHASES_AND_GATES.md`), following Human Gate
B's approval (2026-09-12). The real production Round Board (`src/components/round/round-board.tsx`,
1250+ lines) — not a UI-Lab copy.

`08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §A`'s own instruction — "Keep as dense professional
workbench... no decorative dashboard widgets above the work area. Support widgets are allowed
only in an inspector/context rail" — describes what Round Board already is, not a call to add
anything new to the main work area. Every existing mutation (drag/drop/touch move, per-match
generate, round-level regenerate/clear, emergency repair options, manual add/remove) is **frozen,
completely untouched** — verified by all 17 pre-existing `round-board.test.tsx` tests passing
unchanged, including the two tests dedicated specifically to the Regenerate/Clear open/closed-
boundary visibility logic this pass touches the surrounding layout of.

**What changed — a material swap, not a composition addition.** Two Touchline Finish primitives
(ADR-0135) already existed in `src/components/touchline/workbench/` —
`WorkbenchToolbar`/`WorkbenchSummaryStrip` — purpose-built for exactly this route (their own doc
comments cite Round Board directly), proven in the Phase 3 UI-Lab route
(`/dev/ui-lab/atlas/routes/round-board`), and already used in production by League's own
"Open Round Board" feature toolbar (`WorkbenchToolbar`, §15) — but never actually wired into the
real Round Board page itself until now.

- **`WorkbenchSummaryStrip` replaces `RoundStatusStrip`**. The old component rendered a
  `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` of `MetricTile`s — exactly the "dashboard card"
  pattern the bundle spec warns against elsewhere (Insights §21's identical anti-pattern). The
  replacement is a 1:1 port of the *exact same conditional facts* (Squads filled always;
  Support needed/Squad repair/Blocked/Decisions each only when > 0; Squad places always) into a
  new pure function, `buildRoundWorkbenchSummaryItems()`
  (`src/lib/rounds/get-round-workbench-summary.ts`) — no new query, no threshold change, no
  wording change beyond what the tone vocabulary requires (`WorkbenchSummaryItem`'s
  `"neutral"|"attention"|"danger"` is narrower than `MetricTile`'s own tone set; the two
  `"success"` cases collapse to `"neutral"`, a disclosed, cosmetic simplification only).
- **`WorkbenchToolbar` wraps the existing Regenerate/Clear buttons.** Same
  `regenerateRoundAction()`/`setShowClearRoundDialog()` handlers, unchanged; only the surrounding
  layout changes from a bare `flex flex-wrap` row to the toolbar's context-left/actions-right
  grammar, with the round label as the context.
- **`round-status-strip.tsx` removed** — its only consumer was `round-board.tsx`; this is now
  dead code per the mandatory cleanup rule.

Verified: full `npm run validate` (14/14), 7 new unit tests
(`get-round-workbench-summary.test.ts`) covering every conditional inclusion rule and the
deterministic ordering, all 17 pre-existing `round-board.test.tsx` tests passing unchanged, and a
real screenshot (desktop + mobile) against the seeded Fjordvik FK dataset confirming
`WorkbenchSummaryStrip` renders correctly ("1/3 Squads filled · 1 Blocked · 26/27 Squad places").
The captured round's planning boundary happened to already be closed (kickoff had passed), so
`WorkbenchToolbar`'s Regenerate/Clear rendering was verified via the existing dedicated
component tests rather than a second live screenshot of the open-boundary case — a reasonable,
disclosed trade-off given the change to that code path is a pure layout wrap with unchanged
conditional logic and handlers.

## 23. Phase 5 — Lineup + Tactics production migration (2026-09-12)

Second of the seven Phase 5 routes. `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §B` ("Lineup") and
§C ("Tactics") both map onto the **same single production surface** — the match detail Tactics
tab (`src/components/matches/match-tactics-panel.tsx`), which already served the golden's
"Lineup" concept (editable pitch + formation controls + bench/candidate assignment). §C's
"selected-player inspector" — identity, exact current role, positional fit — was the one
genuinely missing piece, not built anywhere in this codebase before this pass.

**All existing mutation logic is frozen, completely untouched**: formation selection, "Suggest
lineup"/apply, per-slot player assignment (`assignPlayerToSlot`), the `PlayerPicker` dialog flow,
partnership evidence, planning-boundary gating. The only new capability is a read-only
"Positional fit" inspector, rendered in the existing `aside` column beside the pitch, using two
already-built Phase 2 widgets (`TouchlineInspector`, `PositionFitList`) and one new, pure,
unit-tested domain function, `computePlayerPositionFitEntries()`
(`src/domain/positions/position-fit-entries.ts`) — groups a player's exact-role suitability
(ADR-0129) across the 11 outfield exact roles by tier, via `classifyExactSuitability()` (already
existed, already used elsewhere for the same matrix). "GK" is excluded from the grouping,
matching the same goalkeeper-boundary precedent `OutfieldStructuralRole` already established
(Bundle 5, ADR-0116, D-011). `tertiaryPosition`/`bestSide` are not yet loaded onto the panel's
`selections` prop, so the fit computation uses primary/secondary declarations only — a
disclosed, deliberate scope reduction (the same "prefer zero new queries" discipline as Match
detail's own deferred "Availability" widget, §19); a future pass can widen the existing query.

**A real, non-trivial shared-primitive problem found and fixed while wiring this in**: the
pitch's slot-click handler (`TacticsBoard`/`PitchLineupView`, shared by Round... by Match detail's
Tactics tab *and* Event's match lineup panel) gates its `onClick` entirely on `!readOnly` — so a
click does nothing at all once a match's planning boundary has closed. This is *correct* for the
existing assignment flow (a closed lineup must not be editable), but it also meant the new
inspector could never work on exactly the state where reviewing a locked lineup's positional
detail matters most. Fixed by adding a new, additive, optional `onSlotView` callback to
`TacticsBoard`'s `LineupRenderProps` (and threading it through `PitchLineupView`) that fires on
every occupied-slot click *regardless of* `readOnly`, entirely separate from the existing
`onSlotClick` (which keeps its exact original `!readOnly` gate, unchanged) — an occupied slot is
now clickable whenever *either* editing is allowed *or* a view-only inspector is wired up; an
empty slot's click/edit affordance is untouched (there is nothing useful to inspect in an empty
slot). Omitting the new prop changes nothing for any existing caller — verified directly: Event's
`event-match-lineup-panel.tsx` does not pass `onSlotView` and its own `handleSlotClick` has no
independent `readOnly` check of its own, so it depends entirely on the shared primitive's
existing gate remaining exactly as strict as before.

**This exact risk was concretely caught, not just reasoned about**: the new component test suite
(`tactics-board.test.tsx`) caught two real bugs in the first draft of this change before it ever
reached a screenshot — (1) the outer `TacticsBoard` dispatcher's `lineup-assignment`/
`lineup-readonly` branch destructured `onSlotClick` from its props but forgot to also destructure
and forward the new `onSlotView`, so it silently never reached `LineupContent` at all; (2) once
that was fixed, the shared click handler fired `onSlotClick` *unconditionally* whenever the
button was clickable at all (i.e., whenever `onSlotView` made it clickable), which would have
meant a read-only board with `onSlotView` wired up could still trigger the *assignment* callback
— exactly the mutation-safety regression this whole exercise had to avoid. Both were fixed and
are now locked in by name: "does NOT fire onSlotClick on a read-only board (existing edit-gating
behaviour, unchanged)" and "DOES fire onSlotView on a read-only board (the new, additive
capability)".

Verified: full `npm run validate` (14/14), 5 new unit tests for `computePlayerPositionFitEntries()`
(including a normative regression lock for ADR-0129's own worked example, "CM → LW/RW is
DEVELOPMENTAL"), 4 new component tests for `TacticsBoard`'s `onSlotClick`/`onSlotView` split (the
two bug-catching tests above plus a baseline editable-mode test and a no-callbacks-supplied
render test), and a real screenshot confirming the inspector renders correctly — clicking "Luca
Moretti" (declared CM) on a **planning-closed** (read-only) match's Tactics tab correctly shows
"Natural fit: CM · Strong fit: DM, AM · Plausible fit: CB, LM, RM · Developmental positional fit:
LB, RB, LW, RW, ST" in a new "Inspector" panel, with the existing pitch/Squad/Empty-slots panels
completely unaffected.

**Deliberately deferred, not silently dropped**: the spec's mobile "selected-player bottom sheet"
(item 4 of §C's mobile order) — the inspector currently renders as a stacked, full-width panel on
compact viewports (the existing `aside` column's own responsive behaviour), functional but not
the dedicated bottom-sheet interaction pattern the golden shows. A future pass can adopt the
existing `BottomSheet` primitive (already used elsewhere, e.g. Round Board) for this specific
surface without needing to touch any of the mutation/inspector logic built in this pass.

## 24. Phase 5 — Rotations production migration (2026-09-12)

Third of the seven Phase 5 routes. The real production match-detail Rotations tab
(`src/components/matches/planned-rotation-panel.tsx`) — not a UI-Lab copy. Every existing
mutation (create/edit/move-up/move-down/delete a planned change, generate a rotation plan, apply/
skip/delay during live reporting) is **frozen, completely untouched**.

The panel's changes list was a flat, individually-bordered card per row — arguably the exact
"disconnected substitution-card grid" `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §D` explicitly
warns against, and missing the spec's "exact chronological decision points" treatment entirely.
Replaced with the same `TouchlineTimeline`/`TimelineItem` primitives Today already uses — a pure
visual wrapper swap, not a rewrite: every existing control inside each row (move up/down, edit,
remove, the status pill, notes) moved unchanged into `TimelineItem`'s `children` slot. A new pure
function, `computeRotationTimelineStates()` (`src/lib/planned-rotation/get-rotation-timeline-
states.ts`), maps each change's already-known `status` to a timeline node state — `APPLIED` →
`"done"`, the first non-applied change in plan order → `"next"`, every later one → `"later"` —
mirroring the exact current/next/later vocabulary `TodayOperationalTimeline` already established.
No new query; `rotation.changes` was already fully loaded. The previously-duplicated inline
"~MM'SS″" time text (shown both in the timeline's own time column and again inside the row
content) was consolidated to the timeline's time column only, removing the redundant duplicate
within one row — a genuine improvement, not information loss (unlike the intentional "shown
twice, once as a shortcut" pattern used elsewhere in this program, which spans two *different*
locations on a page, not the same row).

**Deliberately left unconsolidated, a disclosed decision**: the panel currently shows three
separate diagnostic boxes (plan-validation issues, automatic-generation notes, squad-coverage
checks), each its own bordered box with its own header. The UI-Lab reference's own
`PlanningReadinessWidget` merges checks and warnings into one widget, but its fixture only ever
modeled one undifferentiated diagnostics array — production's three categories are genuinely
different domain concepts (the draft's own internal validity, the automatic generator's
disclosed limitations, and squad-composition coverage), and forcing them into one generic
"warnings" list would blur that distinction (the plan-validation box also currently
distinguishes real errors from softer notes by colour, which the widget's single `--warning`
treatment doesn't support). Left as-is rather than force a widget swap that isn't confidently a
net improvement — a genuinely different judgement call from Round Board's `WorkbenchSummaryStrip`
swap, where the underlying facts were a true 1:1 match.

Verified: full `npm run validate` (14/14), 5 new unit tests for `computeRotationTimelineStates()`,
and a real screenshot (desktop + mobile) confirming the timeline renders correctly — a single
applied change ("Elias ↔ Theo, pos. swap" at "~30'00″") shown as a "done"-state timeline item,
with every existing control (move arrows, edit/remove buttons, "Add change", "Delete plan", the
existing rotation-pattern evidence panel) unchanged below it.

## 25. Phase 5 — Live Reporting (no change, documented) and Follow Live production migration (2026-09-12)

Fourth and fifth of the seven Phase 5 routes, addressed together since one is a deliberate
"already covered" finding about the other's sibling surface — matching the Players/Player-detail
combined-verdict precedent from Phase 4.

**Live Reporting (`src/components/live-match/live-match-client.tsx`) — no code change.** This is
the highest-stakes surface touched by the Atlas programme: ADR-0133 documents a real production
incident (Rød v Drammens BK, 2026-09-09) that drove a durability-hardening pass (H1–H6) across the
live-session clock, event recording, local-first sync, and realtime reconciliation logic —
explicitly **frozen** here per that same discipline. The component's own doc comment above its
scoreboard states the current compact layout is deliberate: *"a compact operational-focus density
(one row, sticky) rather than the full MatchHeader: the live action buttons must stay above the
fold."* Its primary/secondary control grid (`min-h-[64px]`/`min-h-[48px]` touch targets) is
similarly tuned, not incidental. Swapping in the Atlas `MatchLiveStrip`/`LiveActionGrid` widgets
here would replace an already-hardened, incident-informed interaction surface with a generic one
for a purely cosmetic gain — the opposite of this programme's "implementer, not designer"
contract, and exactly the kind of forced widget substitution the mandatory coding-agent workflow
warns against. No production code was changed. This is recorded as the deliberate outcome, not a
gap: Live Reporting is already substantially composed per the golden reference's own scoreboard/
action-grouping intent, achieved independently during ADR-0134 Phase 7/9's earlier material
migration (AGENTS.md: "all live-session/clock/event-recording/local-sync/realtime mutation logic
frozen").

**Follow Live (`src/components/live-match/follow-live-client.tsx`) — real, narrow change.** This
sibling read-only viewer (never calls `recordEvent`/`endSession`, no mutation controls at all —
its own doc comment: *"defense in depth"*) had the same flat, plain divide-y "Match events" list
already fixed elsewhere this phase. Replaced with the same `TouchlineTimeline`/`TimelineItem`
primitives Rotations and Today already use: the most recent event (`projection.recentEvents`'
current chronological ordering is unchanged — `events.slice(-50)` keeps oldest-first/newest-last,
so the last array item is genuinely the most recent) renders as the `"current"` node, every
earlier one `"done"`. No new query — `eventSummaries` was already fully derived from the existing
`LiveMatchProjection`. The scoreboard (`MatchScoreHeader`), on-field list, and connection-state
banner are unchanged. The now-unused `cn` import was removed as part of the same edit.

No new pure-logic module was extracted — unlike Rotations' multi-branch status mapping, the
state rule here is a single inline ternary (`i === eventSummaries.length - 1 ? "current" :
"done"`), too small to warrant its own tested unit alongside the already-tested shared
`TouchlineTimeline` primitive.

Verified: full `npm run validate` (14/14 — lint, typecheck, the full unit + component suite,
build, and every other gate). **Screenshot capture was not performed for this specific change**:
Follow Live only renders meaningful content once connected, via realtime WebSocket ticket, to an
active `MatchSessionObject` Durable Object session in the separate Cloudflare Worker
(`workers/live-match/`) — no committed seed script creates a live session, and standing up the
Worker locally purely to screenshot a list-wrapper swap was judged disproportionate to the change's
risk. Confidence instead rests on: the identical presentational primitive already screenshot-
verified twice this phase (Rotations, and originally Today), a clean `tsc`/`eslint` pass, and the
full test suite passing with the shared `TouchlineTimeline` component's own existing tests intact.

## 26. Phase 5 — Post-match production migration, completing all seven named routes (2026-09-12)

Seventh and final of Phase 5's named routes. The real production report surface
(`src/components/matches/post-match-report-shell.tsx` — shared by both League's
`src/components/assistant/post-match-page.tsx` and Event's
`src/app/(app)/events/[eventId]/event-match-report-panel.tsx`, per ARR-0034's "one owning
implementation, multiple adapters"). Every existing mutation (complete/reopen, goal/assist
add-remove, attendance, add/remove player, team notes, planned-squad absence marking, player
stats) is **frozen, completely untouched** — only presentation/composition order changed.

`06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §H` specifies a strict order: final score → report
status → participation corrections → goals/assists → team reflection → player observations →
**submit** (last). Two real, disclosed gaps were found against this:

1. **The Complete/Reopen submit action was rendered in the shell's header, first, not last.**
   Moved to the bottom of the shell, after every correction section (`extraSections`) and the
   completion banner — matching the golden's "submit is the final deliberate action, after
   reviewing everything above it" intent. The header now carries only team identity and the
   report-status pill. No handler changed: `actions.complete`/`actions.reopen` are called
   identically, only their button's position moved. Locked in with 4 new component tests
   (`post-match-report-shell.test.tsx`) asserting the buttons render after `extraSections` in DOM
   order and still invoke the same action on click.
2. **League's page composition rendered `FootballObservationSection` (player observations, spec
   item 6) before `TeamReflectionSection` (team reflection, item 5)** — the reverse of the
   golden's order.  Event's own `EventMatchReportPanel` already rendered these two sections in
   the *correct* order (team reflection before football observations) — this was a League-only
   composition bug, not a shared-shell issue. Fixed by swapping the two elements in
   `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`; no other page renders both
   sections, confirmed by search.

**Deliberately left as-is, a disclosed decision**: the shell's internal grouping of Result (final
score) + Goals + Assists inside one `<Surface>`, with the separate Attendance `<Surface>`
following it, is not reordered to strictly interleave "final score, then participation, then
goals/assists" as a literal three-step sequence. Score and its goal/assist events are one
cohesive "match facts" surface a coach reads together; splitting them apart to chase the spec's
exact numbered order would fragment that cohesion for no clear coach-facing benefit, unlike the
two changes above which were genuine ordering mistakes (a submit button appearing before the
content it submits; player observations appearing before the team reflection that usually frames
them). This mirrors the same judgement call already applied to Rotations' three separate
diagnostic boxes (§24) — matching the golden's literal step order is not an end in itself where
doing so would blur a currently-coherent grouping of related facts.

Verified: full `npm run validate` (14/14), 4 new component tests, and real screenshots (desktop +
mobile) captured against the locally-seeded Fjordvik FK dataset's connected-story match (Fjordvik
Rød vs Bergstad IF, a real `LOCKED` report with goals, an assist, an own goal, and a seeded
football observation) via the test-agent auth flow — confirming both fixes render correctly:
"Reopen report" now appears below the completion banner and every correction section, and "Team
reflection" now renders before "Football observations".

**This completes all seven named Phase 5 routes** (Round Board, Lineup, Tactics, Rotations, Live
Reporting, Follow Live, Post-match). See ADR-0136 for the Human Gate C status this triggers.
