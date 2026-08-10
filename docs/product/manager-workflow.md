# Manager Workflow

> **Status:** This document is a historical product framing reference. The canonical workflow is defined in `AGENTS.md` and `features/matchboard.feature`.

## Product framing

Matchboard is a private coach-facing football operations cockpit for match-round squad planning, controlled player movement, coaching intent, matchday responsibility, plan integrity signals, finalized history, and post-match reflection across a league season.

It is not a generic club-management platform, not a parent communication platform, and not a public player evaluation system.

## Primary workflow

The canonical primary workflow (from AGENTS.md):

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Define intent** — Set match purpose, team risk, desired football behavior, support need, development focus.
3. **Populate all** — Generate draft selections for all rounds in the active league season. Each round uses round-level orchestration. No round is finalized.
4. **Review** — Inspect draft selections, plan integrity signals, fairness impact, explanations, and coaching intent alignment. Resolve blockers. Manually adjust draft squads if needed.
5. **Adjust** — Manual changes are allowed. Manual changes must show impact. Manual changes must preserve auditability.
6. **Finalize** — Lock one round at a time, or lock individual matches within a round. Finalized rounds and matches become history and cannot be silently mutated.
7. **Reflect** — Record team-level reflection. Record player-level feedback only where useful. Use observable behavior.
8. **Learn** — Use history, readiness, feedback, and fairness to inform later planning. Do not mutate finalized historical plans.

## Central operating flow

`Assistant → Fixtures → Round Board → Match reporting → Season/History review`

## Assistant page

The Assistant page shows the next action based on workflow state. It derives work items from live database state using `getAssistantCommandCentre()`, not from persisted `AssistantIssue` rows.

The Assistant page must always show the next action based on workflow state. The CoachingIntentSelector must not appear on the Assistant page — intent belongs on Fixtures and Round Board.

## Plan integrity signal model

Active prominent signals are restricted to:
1. **Blocked** — Squad below minimum accepted size, selected unavailable player, duplicate planned assignment
2. **Decision required** — Available eligible player without planned match opportunity

Planning notes are informational only and do not create Assistant work items.

## Post-match workflow

"After match" opens the reporting workspace directly. Reports use a single "Complete report" action instead of separate Submit and Lock steps.

## Privacy requirements

Assistant work items, explanations, decisions, and external payloads store player IDs, not names. Coach-facing data remains private by default.