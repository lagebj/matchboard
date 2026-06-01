# Source-of-Truth Register

## Purpose

Matchboard distinguishes canonical facts, derived projections, historical snapshots, compatibility fields and live derived state. Every important fact in the application must have one documented canonical source. No second writable truth may be introduced for an existing fact without an explicit decision recorded here.

## Definitions

| Term | Meaning |
|------|---------|
| Canonical fact | The single authoritative record. All reads for display must derive from this source. Writes must go through validated paths only. |
| Derived projection | A computed or cached value derived from canonical facts. May be rebuilt but never independently written. |
| Historical snapshot | A value frozen at finalization time (e.g. finalized selection status). Reads use the snapshot; it must not be mutated. |
| Compatibility field | A deprecated field kept temporarily for backward compatibility. Documented as non-canonical. Must not be independently written. |
| Live derived state | A value computed on demand from current data (e.g. plan integrity signals). Never persisted as authoritative truth. |
| Reconciliation | Correcting derived projections to match canonical facts. Never invents facts. |
| Factual correction | Correcting an error in canonical data. Requires human review. Must not be automated. |

## Canonical truth table

| Domain fact | Canonical source | Derived/read models | Permitted writes | Invariant | Status |
|---|---|---|---|---|---|
| Final match result | `PostMatchReport.homeGoals`, `awayGoals` in REPORTED/LOCKED status | Fixtures display | Coach via post-match form | A final result may be complete even if individual scorers are incomplete | Active |
| Known player goal | `Goal` row with `playerId` in REPORTED/LOCKED report | Players overview, Player profile, Season overview | Coach via add/remove Goal UI | Known own-team Goal events must not exceed recorded own-team score where side is determinable | Active |
| Player goal total | Aggregation of canonical `Goal` rows per player per scope | Display columns | Derived only — never independently written | Must equal sum of Goal events | Active |
| Player assist total | `Assist` row with `playerId` in REPORTED/LOCKED report | Players overview, Player profile, Season overview | Coach via add/remove Assist UI | Must equal sum of Assist events | Active |
| Player actually played | `PostMatchPlayerActual` with `attendanceStatus = PRESENT` in REPORTED/LOCKED report | Players overview, Player profile, effective participation, fairness | Coach via post-match form | Only PRESENT counts as played | Active |
| Planned player did not play | `MatchReportAbsence` with structured reason | Players overview absent count | Coach via post-match absence form | Every finalized planned player must have PRESENT or exactly one absence in completed report | Active |
| Planned selection | `Selection` rows with FINALIZED status | Season overview, Round board | Selection engine + manual draft edits (with audit) | One planned assignment per player per round | Active |
| Matchday participation reality | `PostMatchPlayerActual` (including unplanned) with PRESENT | Fairness context, participation totals | Coach via post-match form | Actual participation belongs to post-match history; must not mutate finalized planned selections | Active |
| Current plan integrity | Derived live from `computeRoundPlanIntegrity` | Assistant, Round review, Players current round attention | Derived — never persisted as authoritative | Must not make stale Warning or AssistantIssue rows authoritative again | Active |
| `MatchReportPlayerStat.goals` | Compatibility field — derived projection from `Goal` events | No display reads must use this as truth | No independent UI writes; may be rebuilt from Goal events as a cache if needed | Must equal sum of Goal events for the same report/player; mismatches reported by integrity audit | Compatibility |
| `MatchReportPlayerStat.assists` | Compatibility field — derived projection from `Assist` events | No display reads must use this as truth | No independent UI writes; may be rebuilt from Assist events as a cache if needed | Must equal sum of Assist events for the same report/player; mismatches reported by integrity audit | Compatibility |
| Availability status | `Availability` table for current round planning | Round board player availability | Coach via availability form | Applies to draft planning; does not count as actual participation | Active |
| Movement candidate preference | `MovementCandidate` rows with ACTIVE status | Team detail movement candidates tab, selection engine scoring | Coach via team detail movement candidate tab | Candidate is a soft preference; does not bypass hard eligibility rules (RotationPath, nonRotatable, same-round conflict) | Active |

## Confirmed decisions

### Final match result
- Canonical source: `PostMatchReport.homeGoals` and `awayGoals` in REPORTED/LOCKED report
- A final result can be complete even if individual scorers are incomplete
- Never infer scorers from final score

### Player goals
- Canonical source: `Goal` row with `playerId` in REPORTED/LOCKED report
- `MatchReportPlayerStat.goals` is a compatibility field, not independent truth
- Players overview and player profile must read goals from Goal events
- Never manufacture Goal events from historical aggregate values automatically
- Known own-team Goal events must not exceed recorded own-team score where side is determinable

### Player assists
- Canonical source: `Assist` row with `playerId` in REPORTED/LOCKED report
- `MatchReportPlayerStat.assists` is a compatibility field, not independent truth
- Players overview, effective participation, and player profile must read assists from Assist events
- Never manufacture Assist events from historical aggregate values automatically

### Actual appearances
- Only `attendanceStatus = PRESENT` in REPORTED/LOCKED reports counts as played
- `UNKNOWN` does not count as played
- `NO_SHOW` does not count as played
- Draft/finalised planned selections do not count as actual appearances
- Present unplanned additional participation counts factually without planning warning

### Planned player did not play
- Every finalized planned player must be resolved before report submission
- `UNKNOWN` is unresolved and blocks completion
- `NO_SHOW` may remain only as compatibility/non-played status; structured absence is the reason truth
- Correction between outcomes must reconcile attendance and absence in one transaction

### Planned selection vs actual participation
- Never rewrite finalized planned selections when recording actual reality
- One planned assignment per player per round
- Actual additional appearances remain historical load context

### Live plan integrity
- Derived from `computeRoundPlanIntegrity`
- Do not make stale `Warning` or `AssistantIssue` rows authoritative again
- Only audit or safely reconcile stale projections through canonical plan-integrity boundary

### Movement candidate preference
- Canonical source: `MovementCandidate` rows with ACTIVE status
- Does not bypass hard eligibility rules (RotationPath authority, nonRotatable, same-round conflict)
- Does not replace `supportSuitability` or `developmentReadiness` player attributes
- Does not change core team membership
- Active candidates receive a +12 scoring bonus in selection engine — a preference, not a guarantee
- PAUSED candidates are excluded from scoring but record is preserved
- SUPPORT candidates are compatible with BACKFILL rotation paths
- DEVELOPMENT candidates are compatible with CONFIDENCE_REBUILD rotation paths
- Unique constraint on `[playerId, rotationPathId, role]` — no duplicates
- Coach-facing only — must never appear in parent-facing exports or external AI payloads

## Audit candidates

Fields and structures identified as potential duplicate or legacy sources. These are audited but not modified in this branch without a separately proven safe migration.

| Candidate | Concern | Read paths | Write paths | Measurable divergence | Changed now? | Follow-up |
|---|---|---|---|---|---|---|
| `Team.minSupportCount` / `Team.minSupportPlayers` | Two fields for same concept; may diverge | Selection engine, team config | Team config UI | Count vs player-list disagreement | No | Follow-up: unify or derive |
| `Match.opponent` / `Match.opponentTeamId` → `OpponentTeam.displayName` | Free-text snapshot vs persisted entity | Match display, fixture list | Match creation form | Free text differs from persisted display name | No | Follow-up: migration to OpponentTeam only |
| `Selection.explanation` / `SelectionExplanation` table | Two storage locations for selection rationale | Round board, explanations | Generation engine | Content divergence | No | Follow-up: determine canonical and deprecate other |
| `Player.currentAvailability` / `Availability.status` | Snapshot vs per-round actual | Round board player availability | Availability form | Stale snapshot vs current round reality | No | Follow-up: derive from Availability only |
| `Player.supportNoShowCount` | Counter vs factual derivation from reports | Fairness, selection | Report completion | Counter drift from actual report counts | No | Follow-up: derive or reconcile |
| `Selection.role` / `MovementLedger` role values | Legacy BACKFILL vs new SUPPORT for squad repair | Display, movement tracking | Generation engine | Same movement shows different roles | No | Follow-up: complete BACKFILL→SUPPORT migration |
| `Selection.controlledDoubleLoad` / `MovementLedger.controlledDoubleLoad` | Legacy double-load fields | Effective participation | Legacy generation | Fields may be inconsistent | No | Follow-up: deprecate when migration complete |
| `Warning` rows / live plan integrity | Stale written projections vs canonical derived calculation | Formerly: Assistant issues; now: plan integrity | Generation engine writes, reconciliation updates | Stale Warning rows not matching canonical live state | No | Follow-up: full reconciliation sweep |

## Production correction principles

1. Never infer scorers from score totals
2. Never infer historical attendance from UNKNOWN status
3. Preserve finalized plans and post-match history
4. Dry-run before writes
5. Use approved deploy-safe execution
6. Record results without personal or sensitive data
7. Reconciliation is idempotent: running twice produces the same result
8. Factual corrections require human review
9. Derived projections may be rebuilt from canonical sources

## Implementation status (2026-05-27)

### Completed

| Change | Files | Status |
|---|---|---|
| Integrity audit service | `src/lib/data-integrity/audit-data-integrity.ts`, `types.ts` | Committed: 5 mandatory checks (goals, assists, UNKNOWN attendance, planned absence, score vs events) + 6 candidate stubs |
| Reconciliation module | `src/lib/data-integrity/reconcile-canonical-derived-data.ts` | Committed: goals projection, assists projection, opponent snapshot, plan integrity |
| Goal truth: players overview | `src/lib/players/get-players-overview.ts` | Committed: reads from Goal events |
| Goal truth: effective participation | `src/lib/selection/effective-participation.ts` | Committed: reads from Goal events |
| Goal truth: effective appearances | `src/lib/selection/get-effective-appearances.ts` | Committed: reads from Goal events |
| Assist truth: `Assist` model | `prisma/schema.prisma` | Committed: Assist model mirroring Goal, playerId required, type field |
| Assist truth: server actions | `actions.ts` (addAssistToReport, removeAssistFromReport) | Committed |
| Assist truth: post-match UI | `post-match-page.tsx` | Committed: add/remove assist UI mirroring goals |
| Assist truth: players overview | `src/lib/players/get-players-overview.ts` | Committed: reads from Assist events |
| Assist truth: effective participation | `src/lib/selection/effective-participation.ts` | Committed: reads from Assist events |
| Assist truth: effective appearances | `src/lib/selection/get-effective-appearances.ts` | Committed: reads from Assist events |
| Assist truth: audit | `src/lib/data-integrity/audit-data-integrity.ts` | Committed: checkAssistAggregateDiffersFromAssistEvents |
| Assist truth: reconciliation | `src/lib/data-integrity/reconcile-canonical-derived-data.ts` | Committed: reconcilePlayerAssistsDerivedProjection |
| Opponent snapshot: audit | `src/lib/data-integrity/audit-data-integrity.ts` | Committed: checkCandidateOpponentIdentityDivergence |
| Opponent snapshot: reconciliation | `src/lib/data-integrity/reconcile-canonical-derived-data.ts` | Committed: reconcileOpponentSnapshotDerivedProjection |
| Admin audit API | `src/app/api/admin/audit/route.ts` | Committed: GET endpoint |
| Admin reconcile API | `src/app/api/admin/reconcile/route.ts` | Committed: POST endpoint |
| UNKNOWN attendance blocks submission | `actions.ts` (submit + lock) | Committed: server-side validation |
| UNKNOWN attendance blocks locking | `actions.ts` (lock) | Committed: server-side validation |
| UNKNOWN blocks completion (assistant) | `service.ts` (completePostMatchReport) | Committed: throws on UNKNOWN |

### Not yet changed

| Area | Current behavior | Needed change | Priority |
|---|---|---|---|
| Warning/plan integrity reconciliation | `reconcile-canonical-derived-data.ts` exists | Production dry-run and full sweep not yet executed | Medium |
| `Team.minSupportCount` / `minSupportPlayers` divergence | Audit detects | No unification yet | Low |