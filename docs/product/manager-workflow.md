# Manager Workflow

> **Status:** This document is a historical product framing reference. The canonical workflow is
> defined in `AGENTS.md` and `features/matchboard.feature`. Adaptive/compact composition rules
> are in `docs/product/adaptive-interaction-design.md` and **ADR-0124**.

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
6. **Finalize (derived, not a coach action — ADR-0109)** — There is no "Finalize round" /
   "Finalize match" button. The plan becomes historical automatically the moment a match's
   real-world planning boundary closes (scheduled kickoff passes, or live reporting starts,
   whichever is first). Finalized rounds and matches become history and cannot be silently
   mutated. A genuine reschedule that proves a match hasn't started can reopen its planning.
7. **Reflect** — Record team-level reflection. Record player-level feedback only where useful. Use observable behavior.
8. **Learn** — Use history, readiness, feedback, and fairness to inform later planning. Do not mutate finalized historical plans.

## Central operating flow

`Today → League → Round Board → Match reporting → Season/History review`

The operational sequence each primary surface optimises for is Scan → Understand → Decide → Act
→ Confirm (`docs/product/adaptive-interaction-design.md` §1).

## Today page

Today (`/o/{orgSlug}/today`) shows the next action based on workflow state. It derives work items
from live database state using `getAssistantCommandCentre()`, not from persisted `AssistantIssue`
rows. `/assistant` remains a valid deep-link alias.

Today must always show the next action. On compact it leads with the dominant Next Action object,
then a chronological now/next/later flow, then quieter secondary coaching context — never a
detached metric grid ahead of the Next Action. The CoachingIntentSelector must not appear on
Today — intent belongs on Fixtures and Round Board.

## Plan integrity signal model

Active prominent signals are restricted to:
1. **Blocked** — Squad below minimum accepted size, selected unavailable player, duplicate planned assignment
2. **Decision required** — Available eligible player without planned match opportunity, when that player's core team has a non-cancelled match in the round (Round Board visibility alone never creates the obligation)

Planning notes are informational only and do not create Assistant work items.

## Post-match workflow

"After match" opens the reporting workspace directly. Reports use a single "Complete report" action instead of separate Submit and Lock steps.

## Privacy requirements

Assistant work items, explanations, decisions, and external payloads store player IDs, not names. Coach-facing data remains private by default.