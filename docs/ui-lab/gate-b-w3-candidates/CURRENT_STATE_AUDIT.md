# B06 — Current state audit

## Route and data ownership

| | League | Event |
|---|---|---|
| Match Details route | `src/app/(app)/o/[orgSlug]/matches/[matchId]/page.tsx` → `/o/[orgSlug]/matches/[matchId]` | **None.** Content lives inline on `src/app/(app)/events/[eventId]/event-detail.tsx`'s Matches tab (`event-matches-tab.tsx`), selected via `?tab=matches`. |
| Lineup editing | Inline on Match Details (`MatchTacticsPanel`), not a separate route | `EventMatchLineupPanel` (`event-match-lineup-panel.tsx`), expanded inline on the Matches tab |
| Live Reporting | `/o/[orgSlug]/matches/[matchId]/live` → `LeagueLiveMatchClient` → shared `LiveMatchClient` | `/o/[orgSlug]/events/[eventId]/matches/[eventMatchId]/live` → `EventLiveMatchClient` → the **same shared** `LiveMatchClient` |
| Follow Live (read-only) | `/o/[orgSlug]/matches/[matchId]/live/follow` → shared `FollowLiveClient` | `.../matches/[eventMatchId]/live/follow` → the **same shared** `FollowLiveClient`, `subjectType="EVENT"` |
| Post-match report | `/o/[orgSlug]/matches/[matchId]/post-match` → `PostMatchReportPageShell` → `PostMatchPage` → shared `PostMatchReportShell` | **None.** `EventMatchReportPanel` wraps the **same shared** `PostMatchReportShell`, expanded inline on the Matches tab |
| Entity id | `Match.id` (`matchId`) | `EventMatch.id` (`eventMatchId`), owned by `EventSquad` → `Event` |
| Lifecycle truth | `deriveMatchLifecycleStatus()` (`src/lib/selection/planning-boundary.ts`) — one enum: `planning_open/planning_closed/live/played/report_incomplete/done/cancelled` | Composite: `EventMatch.status` (`SCHEDULED`/`CANCELLED`) + `EventLiveMatchSession.status` + `EventPostMatchReport.status`, gated by `event-planning-boundary.ts` (shares `isPlanningBoundaryClosed` with League) |

## Component inventory

| Component | File | Reused in this wave? |
|---|---|---|
| `MatchIdentityCard` | `src/components/matches/match-detail/match-identity-card.tsx` | Yes — both League and Event pages (`ownKitColor=null` for Event) |
| `MatchPreparationWidget` | `src/components/matches/match-detail/match-preparation-widget.tsx` | Yes — League · Before |
| `TouchlinePlanningPitch` | `src/components/touchline/pitch/touchline-planning-pitch.tsx` | Yes — both Before pages |
| `buildPlanningPitchAssignments` | `src/components/touchline/pitch/planning-pitch-assignment-projection.ts` | Yes — Event · Before (same call Production's `EventMatchLineupPanel` makes, `teamKitColor: null`) |
| `MatchTimelineList` / `MatchFlowPanel` | `src/components/matches/match-detail/match-timeline-list.tsx`, `match-flow-panel.tsx` | Yes — League · After |
| `PostMatchReportShell` (ARR-0034) | `src/components/matches/post-match-report-shell.tsx` | Yes — Event · After, directly (fixture-injectable; no self-fetch) |
| `PostMatchDebrief` | `src/components/post-match/debrief/post-match-debrief.tsx` | Yes — Event · After, `readOnly` |
| `FootballObservationSection` | `src/components/player-development/football-observation-section.tsx` | Yes — Event · After, `isLocked` |
| `MatchCombinationEvidencePanel` | `src/components/matches/match-combination-evidence-panel.tsx` | Yes — Event · After |
| `DecisionBanner` | `src/components/ui/decision-banner.tsx` | Yes — `variant="note"` disclosures on both Event pages |
| `EventMatchLineupPanel` | `event-match-lineup-panel.tsx` | **No** — self-fetches via server actions (`getEventMatchLineup`, etc.), not fixture-injectable; its real projection logic is reused instead of its markup (same documented gap League's own `MatchTacticsPanel` has in B01) |
| `EventMatchReportPanel` | `event-match-report-panel.tsx` | **No** — same self-fetch reason; its real `extraSections` composition pattern is reused instead |
| `PostMatchReportPageShell` / `PostMatchPage` (League's dedicated page) | `post-match-report-page-shell.tsx`, `post-match-page.tsx` | **No** — already candidated by B05; this wave links to that candidate for League's AFTER "Continue report" action rather than duplicating it |

## ARR-0034's unification, confirmed by this wave's own audit

`PostMatchReportShell` is the same component underneath both League's `PostMatchPage` and
Event's `EventMatchReportPanel` (`docs/arr/0034-league-event-post-match-ui-not-consolidated.md`,
state Resolved). The genuine capability difference is small and already documented
(League-only: planned-squad diff, structured absence, player stats — rendered via
`extraSections`; Event-only: guided debrief + football observations + locked-only combination
evidence, also via `extraSections`). What is **not** unified is the surrounding page: League's
shell lives on a dedicated route with five/four tabs (`match-detail-tabs.ts`); Event's shell is
one scrollable panel with no tabs, reached by expanding a card on Event Detail's Matches tab.

`EventMatchReportPanel`'s own `ReportData` type carries `teamReflection`/`opponentObservation`/
`notes` fields, but its current `extraSections` (read directly from the file, not from the older
ARR-0034 text) render only `PostMatchDebrief`, `FootballObservationSection`, and the locked-only
`MatchCombinationEvidencePanel` — not those three free-text fields. This is left as an observed
fact, not investigated further here (outside this wave's scope); if those fields are genuinely
unreachable now, that is a question for `issue-and-arr-workflow.md`, not something this UI Lab
wave resolves.

## Six-stage lifecycle parity matrix

Per-stage detail (source of truth, canonical ID, nav entry point, primary action,
editable/read-only, data present/missing, return destination, component owner), reproduced from
this wave's own production source audit — not invented.

### 1. Planned / incomplete

| | League | Event |
|---|---|---|
| Source of truth | `planning_open`/`planning_closed` + `squadReady`/`lineupReady` booleans (`match-detail-view-model.ts`) — "incomplete" is a UI state, not a lifecycle enum value | `EventSquad` roster vs. `targetSize`/GK presence, `computeEventSquadReadiness()` — a **roster-level**, not match-level, readiness concept |
| Canonical ID | `matchId` | `eventId` + `eventSquadId` |
| Nav entry point | `/o/[orgSlug]/matches/[matchId]` (Overview, BEFORE) | None dedicated — inline widget on Event Detail's own Overview tab |
| Primary action | Edit squad/lineup/rotation | Add/assign players to the squad |
| Editable | Yes, gated by `isMatchPlanningEditable()` | Yes |
| Data present / missing | Selections, helpers, guests, lineup existence; no report/timeline | Squad size vs. target, GK presence; no match-specific lineup yet |
| Return destination | Same page | Event Detail |
| Owner | `before-match-overview.tsx` | `event-detail.tsx` |
| Parity | **Not directly comparable** — League's is match-scoped, Event's is squad-scoped (roster, not lineup). This wave's "Before" candidates compare the match-scoped lineup stage instead (row 2), which is where both origins genuinely operate on the same match. |

### 2. Planned / ready

| | League | Event |
|---|---|---|
| Source of truth | Same booleans as row 1, now true — no distinct enum value | `EventMatch.status=SCHEDULED`, lineup complete, no live session, no report |
| Canonical ID | `matchId` | `eventMatchId` |
| Nav entry point | Same Match Details route (pill flips to "Ready") | Match card on Event Detail's Matches tab + inline `EventMatchLineupPanel` |
| Primary action | "Start live reporting" becomes available | "Start live reporting" link on the match card |
| Editable | Yes | Yes |
| Data present | Full squad/lineup, planning pitch | Full lineup, eligible-participant pool (squad + approved helpers + guests) |
| Return destination | n/a (same page) | n/a (same tab) |
| Owner | `before-match-overview.tsx`, `match-detail-shell.tsx` | `event-matches-tab.tsx`, `event-match-lineup-panel.tsx` |
| Parity | **Genuine parity in capability** (both plan a real lineup against a real eligible pool); **genuine mismatch in composition** (dedicated route+pitch vs. inline card+pitch) — this wave's League · Before / Event · Before candidates compare exactly this stage. |

### 3. Live

| | League | Event |
|---|---|---|
| Source of truth | `LiveMatchSession.status==="ACTIVE"` | `EventLiveMatchSession.status==="ACTIVE"` |
| Canonical ID | `matchId` + session id | `eventMatchId` + session id |
| Nav entry point | `/o/[orgSlug]/matches/[matchId]/live` (reporter), `/live/follow` (viewer) | `/o/[orgSlug]/events/[eventId]/matches/[eventMatchId]/live` (reporter), `/live/follow` (viewer) |
| Primary action | Record goals/rotations/periods | Same |
| Editable / read-only | Reporter: editable. Follower: read-only | Same |
| Owner | `league-live-match-client.tsx` → shared `LiveMatchClient`; `follow-live-client.tsx` → shared `FollowLiveClient` | `event-live-match-client.tsx` → **the same shared** `LiveMatchClient`; Event's follow page → **the same shared** `FollowLiveClient` |
| Parity | **Identical shared production code.** Not reproduced as a fifth/sixth UI Lab page — doing so would compare nothing. |

### 4. Completed / report incomplete

| | League | Event |
|---|---|---|
| Source of truth | `report_incomplete` (kickoff passed, `PostMatchReport.status` DRAFT/REPORTED) | Session ended, `EventPostMatchReport` absent or freshly seeded |
| Canonical ID | `matchId` → `reportId` | `eventMatchId` → `reportId` |
| Nav entry point | Same Match Details route flips to AFTER composition automatically | None — ending the live session navigates (`window.location.href`, via `LiveMatchClient`'s `reportUrl` callback) to `/events/${eventId}`, i.e. Event Detail, not a match-scoped route; "Open report" button on the match card seeds the report |
| Primary action | "Continue report" → `/post-match` | "Open report" → inline expand |
| Owner | `after-match-overview.tsx` | `event-matches-tab.tsx` |
| Parity | **Mismatch in return-destination granularity** — the core finding this wave surfaces (see SOURCE_RECONCILIATION.md). |

### 5. Report draft

| | League | Event |
|---|---|---|
| Source of truth | `PostMatchReportSurfaceState.DRAFT` (folds in `REPORTED`) | `EventPostMatchReport.status==="DRAFT"` |
| Nav entry point | `/post-match` route, tabs `summary/timeline/players/reflection/review` | Inline expanded panel, no tabs |
| Shared editing shell | `PostMatchPage` → shared `PostMatchReportShell` | `EventMatchReportPanel` → **the same shared** `PostMatchReportShell` |
| League-only extras | Planned squad diff, structured absence, player stats | — |
| Event-only extras | — | Guided debrief (`PostMatchDebrief`), football observations |
| Parity | **Editing capability unified (ARR-0034).** Presentation differs: tabbed page vs. one scrollable panel. |

### 6. Report completed

| | League | Event |
|---|---|---|
| Source of truth | `PostMatchReport.status==="LOCKED"` → root lifecycle `done` | `EventPostMatchReport.status==="LOCKED"` |
| Nav entry point | `/post-match` route, tabs swap `review`→`combinations` | Same inline panel, "Reopen" replaces edit controls |
| Read-only | Yes, `isLocked` disables all mutation controls | Yes, same |
| New data | Combination evidence unlocks | Same — `MatchCombinationEvidencePanel`, locked-only |
| Parity | **Genuine parity** — both this wave's League · After and Event · After candidates present. Deliberately matched to the same 3-1 scoreline so visual differences are presentational, not data differences. |

## ADRs consulted

ADR-0011, ADR-0147, ADR-0152, ADR-0158, ADR-0159, ARR-0034 — see SOURCE_RECONCILIATION.md for
what each is authoritative for.
