# ARR-0051: `Selection` and `MatchLineup` are two unsynced, competing "who's playing" models

## State

Identified

## Identified

2026-09-21

## Residue

Matchboard has two independent Prisma models that both claim to represent "who is playing a
League match," edited on two different pages, with no synchronization or cross-referencing
constraint between them:

- **`Selection`** (`role` of `CORE`/`SUPPORT`/`BACKFILL`/`DEVELOPMENT`/`CONFIDENCE_REBUILD`,
  `status` of `DRAFT`/`FINALIZED`) — edited exclusively via the **Round Board**
  (`/o/[orgSlug]/rounds/[matchRoundId]`, `src/components/round/round-board.tsx`), through
  `src/app/(app)/rounds/[matchRoundId]/draft-selection-actions.ts` /
  `src/lib/selection/manual-draft-edit.ts`.
- **`MatchLineup`/`MatchLineupAssignment`** (formation-slot based: a `Formation` made of
  `FormationSlot`s, one `MatchLineup` per match/team, `MatchLineupAssignment` rows binding a
  `playerId` to a `slotId`) — edited via the **Tactics/formation panel** on the match detail page
  (`src/components/matches/match-tactics-panel.tsx`), through
  `src/app/(app)/matches/lineup-actions.ts`.

Nothing keeps these in agreement. `MatchLineupAssignment.playerId` is not validated against the
match's `Selection` rows — a coach can assign a player to a formation slot who has no `Selection`
row for that match round at all (e.g. was never drafted in, or was marked `BACKFILL`/excluded),
and neither UI surfaces the conflict.

This residue was discovered as the root cause of a live production bug: a coach swapped a player
in the Tactics panel (`MatchLineup`), expecting the AI Advisor (`lineup_review` capability) to
react, but nothing happened. Direct production Postgres inspection (Neon CLI, project
`mute-mode-75031528`) proved the edit *did* persist —
`MatchLineup.updatedAt` matched the edit's timestamp to the second — but
`buildLineupReviewContext()` (`src/lib/ai/context/lineup-review.ts`) only ever reads `Selection`,
and `lineup-actions.ts` never called `triggerAiCapability` at all before this session's fix (see
"Related implementation"). `AiAdvisorJob`/`AiAdvisorReview` had zero rows for the affected match
and for the entire organisation, confirming no signal had ever fired for this data path.

## Intended architecture

`06_AI_CAPABILITY_CONTRACTS.md` (`.matchboard-work/matchboard-ai-advisor-implementation-bundle/`)
explicitly lists "formation; starting positions" as intended `lineup_review` input — i.e. the
original design already assumed a single, unified notion of "who's playing and in what shape"
that both models only partially and separately implement today. Per `PRINCIPLES.md`'s
shared-domain-meaning expectation (also the basis of ARR-0038's resolution), a match's playing
squad and its on-pitch shape should be one consistent, single-sourced concept, not two documents
that can silently disagree.

## Evidence

- `prisma/schema.prisma` — `Selection` model (~line 376) and
  `MatchLineup`/`MatchLineupAssignment`/`Formation`/`FormationSlot` models (~lines 505-585): two
  disjoint schemas, no foreign key or constraint linking `MatchLineupAssignment.playerId` to a
  `Selection` row for the same match/round.
- `src/lib/ai/context/lineup-review.ts` — `buildLineupReviewContext()` reads only `Selection`;
  never reads `MatchLineup`/`MatchLineupAssignment`.
- `src/app/(app)/matches/lineup-actions.ts` — before this session, zero
  `triggerAiCapability`/AI-trigger calls anywhere in the file, despite being a full mutation
  surface for match-day composition.
- `src/app/(app)/rounds/[matchRoundId]/draft-selection-actions.ts` — the sibling file with a
  correct, pre-existing `triggerLineupReview()` pattern for the `Selection` path only.
- Direct production DB evidence (Neon CLI, `matchboard_app` role, database `neondb`, production
  branch `br-little-math-alhf7n5x`): for match "Hvit vs Huringen 1"
  (`id: cmsfxyawg000604ky1u3sigrc`), `Selection.updatedAt` remained frozen at `2026-09-03` across
  a live user-driven edit attempt, while a separate edit produced
  `MatchLineup.updatedAt = 2026-09-21 17:28:45.168` matching the user's action exactly —
  proving the two models are written independently and that only one of them ever triggered
  anything.
- `.matchboard-work/matchboard-ai-advisor-implementation-bundle/06_AI_CAPABILITY_CONTRACTS.md`
  (~lines 121-148) — lists formation/starting-position data as intended `lineup_review` scope,
  which the current context builder does not fulfill.

## Impact

- **AI Advisor blind spot (partially fixed this session):** the missing trigger in
  `lineup-actions.ts` is fixed (see "Related implementation"), so a Tactics-panel edit now
  enqueues a `LINEUP_REVIEW` job. However, the job's context still only reflects `Selection`
  data — a formation-only change (no `Selection` row change) will fire a review, but the
  reviewed content will not describe the actual formation/shape change, only whatever the
  `Selection` table already said. This is a real, still-open functional gap distinct from the
  fixed trigger gap.
- **Data-integrity risk beyond AI Advisor:** any other current or future feature that assumes
  "who's playing" lives in one place risks reading the wrong (or a stale) model. No enforcement
  prevents `MatchLineupAssignment.playerId` from naming a player absent from `Selection`
  entirely.
- **Coach-facing confusion risk:** the Round Board and the Tactics panel can show different,
  unreconciled pictures of the same match's squad, with no visible warning to the coach that
  they are two different data sources.
- **Not yet investigated:** whether matchday-responsibility, round-finalization, or post-match
  reflection features consume either model in a way that would surface (or hide) this
  divergence; whether an existing production match already has drifted `Selection`/
  `MatchLineup` data as a result.

## Containment

- Do not add new AI Advisor (or other) domain-trigger or context-building logic that reads only
  one of `Selection`/`MatchLineup` without explicitly considering the other; new logic should at
  minimum document which model it intentionally ignores and why.
- Do not introduce a third parallel "who's playing" representation to work around this
  residue.
- Any new consumer of match squad/lineup data should ask which of the two current models is
  authoritative for its use case rather than assuming one is the single source of truth.

## Resolution criteria

Not yet decided. A resolution (e.g. sourcing `MatchLineupAssignment.playerId` from `Selection`,
merging the two models, or formally scoping `Selection` = eligibility/role and `MatchLineup` =
on-pitch shape as intentionally separate concerns with an explicit link) requires its own ADR;
this ARR does not prescribe the outcome.

## Disposition

Pending — awaiting an ADR decision on whether/how to consolidate `Selection` and `MatchLineup`.

## Resolution

Not yet resolved.

## Related decisions

None yet. A consolidation decision, if pursued, should be recorded as a new ADR referencing this
ARR.

## Related implementation

This session's immediate fix (trigger-gap only, not a resolution of this residue):
`src/app/(app)/matches/lineup-actions.ts` gained a `triggerLineupReview()` helper (mirroring
`draft-selection-actions.ts`), wired into `changeMatchLineupFormation`, `assignPlayerToSlot`, and
`removePlayerFromSlot`. Regression test:
`src/app/(app)/matches/__tests__/lineup-actions-ai-trigger.test.ts`.

## Supersedes

None.

## Superseded by

None.

## History

- 2026-09-21: Identified while diagnosing a live production report ("AI Advisor never appears")
  via direct Neon Postgres forensics; the immediate trigger-gap symptom was fixed in the same
  session, this ARR documents the deeper, still-open model duplication that caused it.
