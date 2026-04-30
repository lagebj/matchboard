# Implementation Plan: Matchboard UX Overhaul

**Canonical spec:** `docs/specs/ux-overhaul.md` — if this plan disagrees with the spec, the spec wins.

**Status:** Phases 1–7, 10, and implementation gaps (warning persistence, populate-all) are done. Phases 8, 9, 9b, and 11 remain.

## Completed

- Phase 1: Shell cleanup — deleted legacy shell, unified navigation, added redirects
- Phase 2: Copy rewrite — all pages and components use operational labels
- Phase 3: Dashboard as Today — Next Action, Active Round Summary, Setup Progress, Blocking Warnings, Fairness Checks, Recently Finalized
- Phase 4: Top context bar — state machine primary action, 5-state round status
- Phase 5: Round workbench — RoundStatusStrip, MovementChain, WarningCard
- Phase 6: Inspector panels — multi-type inspector (player/warning/match/movement)
- Phase 7: Round list with filters — All/Needs action/Draft/Ready/Finalized
- Phase 10: Delete orphaned pages — 10 pages removed, redirects added
- Implementation gap 1: Warning persistence — warnings now persisted to DB after generation
- Implementation gap 2: Populate-all endpoint — `POST /api/populate-all` with `planningPeriodId`
- Implementation gap 3: Today page setup progress — Setup Progress section showing round generation status
- Implementation gap 4: Prohibited copy alignment in feature file scenarios

## Remaining

- Phase 8: Visual system cleanup (consistent icons, spacing, typography)
- Phase 9: Players and History dense tables (upgrade to sortable/filterable)
- Phase 9b: Team detail workspace (header, summary strip, Squad tab, Current Round tab, Movement tab, History tab, Rules tab)
- Phase 11: Verification and tests

## Architecture decisions (from canonical spec)

- lucide-react for icons
- Inspector panel uses client-side state
- Badge/warning components centralized in `src/components/ui/`
- Round page structured as server component + client islands
- 6 canonical routes only (Today, Rounds, Players, Teams, Rules, History)
- Detail routes: `/rounds/[matchRoundId]`, `/players/[playerId]`, `/teams/[teamId]`
- Prohibited copy: command center, decision inbox, decision debt, structured review room, workspace, optimization output, entity, resource
- Domain language: use "sent as support", "received backfill", "development movement", "dropped" — never "demoted", "benched", "punished", "weak player", "B-team"

## Teams UX model

- `/teams` is a lightweight directory linking to team detail pages
- `/teams/[teamId]` is the primary team workspace with tabs: Squad, Current Round, Movement, History, Rules
- The all-teams page must not become a catch-all dashboard or show squad rosters inline
- Movement language must be neutral coaching language per the prohibited/required terms table

## Stale references removed

- `docs/domain.md` — deleted, do not reference
- `docs/spec-ux-overhaul.md` — superseded by `docs/specs/ux-overhaul.md`