# Spec: Post-Match Reporting Lifecycle

## Objective

Separate planned selection lifecycle from actual match report lifecycle. Every match can have a post-match report recording what actually happened (result, actual squad, goals, assists, absences). The selection engine uses actual appearances when available, planned appearances when not. Player profiles show actual season stats.

Two key domain rules:
1. **Finalized** selection = approved pre-match plan. **Reported** match report = actual match truth. These are separate.
2. **REPORTED** is the source-of-truth state for selection engine calculations. **LOCKED** is an edit-control state.

## Data Model Changes

### MatchReportStatus enum

```
NOT_STARTED  — derived from absence of MatchReport row
DRAFT        — report exists, may be incomplete
REPORTED     — actual data submitted, source of truth for calculations
LOCKED        — reviewed/finalized, requires explicit reopen to edit
```

### Schema changes

Rename `PostMatchReport.status` from free-text to enum. Add new tables:

**MatchReportAbsence** — planned players who didn't play:
- id (cuid)
- matchReportId (FK)
- matchId (denormalized)
- playerId (FK)
- reason: NO_SHOW | SICK | INJURED | DECLINED | NO_RSVP | OTHER
- note (optional)
- createdAt, updatedAt

**MatchReportPlayerStat** — aggregated goals/assists per player per match:
- id (cuid)
- matchReportId (FK)
- playerId (FK)
- goals (int, default 0)
- assists (int, default 0)
- createdAt, updatedAt
- Unique on (matchReportId, playerId)

### Status mapping

| Old value | New value |
|-----------|-----------|
| null (no row) | NOT_STARTED (derived) |
| IN_PROGRESS | DRAFT |
| COMPLETED | LOCKED |
| (new) | REPORTED |

### PlannedAbsenceReason enum

```
NO_SHOW     — No show
SICK        — Sick
INJURED     — Injured  
DECLINED    — Declined
NO_RSVP     — No RSVP
OTHER       — Other (with optional note)
```

## Server Actions

### Match report lifecycle

1. **getMatchReport(matchId)** — Returns report with actuals, absences, stats, goals, planned squad, derived status
2. **seedMatchReport(matchId)** — Creates DRAFT report, copies finalized selections into PostMatchPlayerActual with source=PLANNED; idempotent
3. **updateMatchResult(reportId, {homeGoals, awayGoals, notes})** — Updates result; blocks when LOCKED
4. **addActualPlayer(reportId, {playerId})** — Adds player with source=ADDED_POST_MATCH; blocks when LOCKED
5. **removeActualPlayer(appearanceId)** — Removes player from actuals; blocks when LOCKED
6. **updateAttendanceStatus(appearanceId, status)** — Changes attendance (PRESENT/NO_SHOW/etc); blocks when LOCKED
7. **markPlannedAbsence(reportId, {playerId, reason, note?})** — Creates MatchReportAbsence for planned player not in actuals; blocks when LOCKED
8. **removePlannedAbsence(absenceId)** — Removes absence record; blocks when LOCKED
9. **updatePlayerStats(reportId, {playerId, goals, assists})** — Updates goals/assists; blocks when LOCKED
10. **submitMatchReport(reportId)** — DRAFT → REPORTED; validates squad exists, result present
11. **lockMatchReport(reportId)** — REPORTED → LOCKED; requires REPORTED status
12. **reopenMatchReport(reportId, targetStatus?)** — LOCKED → REPORTED (default) or DRAFT

### Selection engine integration

**getEffectiveAppearances(matchId)** — Returns actual appearances when report is REPORTED/LOCKED, planned selections otherwise. Used by:
- Season fairness calculations
- Player load tracking
- Consecutive support rotation
- Player profile stats

## UI Requirements

### Post-match report page (`/matches/[matchId]/post-match`)

**Header:** Team vs opponent, date, selection status badge, report status badge

**Report actions:** Start report | Save draft | Submit/report | Lock | Reopen — disabled with clear labels for invalid states

**Result section:** Home goals + away goals inputs (editable in DRAFT/REPORTED, read-only in LOCKED)

**Actual squad section:**
- "Seed from planned squad" button (only when NOT_STARTED)
- Player list with: name, core team, source badge (From plan / Added manually), attendance status dropdown
- Add player (player picker from active players)
- Remove player
- Editable in DRAFT/REPORTED, read-only in LOCKED

**Planned but did not play section:**
- List of planned players not in actual squad
- Each with: name, reason dropdown (No show/Sick/Injured/Declined/No RSVP/Other), optional note field
- These players do NOT count as actual appearances

**Goals and assists section:**
- Compact stats table: Player | Goals (±) | Assists (±)
- Only actual squad players can have goals/assists
- Increment/decrement controls, or numeric inputs
- Editable in DRAFT/REPORTED, read-only in LOCKED

**Notes section:** Free-text area for match notes

**Summary strip:**
- Planned count | Actual count | Added post-match | Planned absent | Score | Goals total | Assists total | Report state

### Match detail page additions

- Show both selection status and report status side by side
- Show inline result summary when report exists
- Show "Start report" / "Continue report" / "View report" / "View locked report" button

### Fixtures page additions

- Show report status badge per match (Not reported / Draft / Reported / Locked)
- Expose report action per match

### Player profile additions

- Season stats section: actual appearances, goals, assists, goals per appearance
- Recent matches section: date, opponent, planned (yes/no), played (yes/no), goals, assists, absence reason if applicable
- Stats are sourced from REPORTED and LOCKED reports only, not DRAFT
- DRAFT report data shown separately labeled as "draft" if shown at all

## Selection Engine Integration Rules

| Report Status | What counts for selection calculations |
|---------------|----------------------------------------|
| NOT_STARTED | Planned appearances (current behavior) |
| DRAFT | Planned appearances (draft is not truth yet) |
| REPORTED | Actual appearances (actuals are truth) |
| LOCKED | Actual appearances (actuals are truth) |

**Critical rules:**
- Planned player marked absent in REPORTED/LOCKED report does NOT count as actual appearance
- Player added post-match in REPORTED/LOCKED report DOES count as actual appearance
- No double-counting: a player in both planned and actual is counted once, using the actual data
- DRAFT reports do NOT affect selection calculations

## Implementation Order

1. Prisma schema + migration
2. Match report server actions (lifecycle + CRUD)
3. Selection engine integration (getEffectiveAppearances)
4. Post-match report UI (full rewrite)
5. Match detail page additions
6. Fixtures page additions
7. Player profile additions
8. Tests

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Dev: `npm run dev`

## Boundaries

- Always: Run tests before committing, validate inputs in server actions, use requireCoachAccess()
- Ask first: Changing Prisma enum values, modifying selection engine core pipeline
- Never: Commit secrets, mutate planned Selection from match report actions, allow DRAFT reports to affect selection calculations

## Success Criteria

- Every match can have a post-match report
- Match report status is separate from selection status in all UI
- User can seed actual squad from planned squad
- User can mark planned players who didn't play with a reason
- User can register goals and assists linked to Player
- User can submit, lock, and reopen match reports
- Selection engine uses actual appearances after report is REPORTED/LOCKED
- Player profile shows actual season stats from REPORTED/LOCKED reports
- Tests pass for lifecycle, CRUD, and selection engine integration