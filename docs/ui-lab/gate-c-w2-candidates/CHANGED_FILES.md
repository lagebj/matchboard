# Gate C W2 — Changed Files

## Production fixes (bounded, acceptance-contract-required — see `CURRENT_STATE_AUDIT.md`)

- `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx` — forwards `integrity.coverage` to `RoundBoard`.
- `src/components/round/round-board.tsx` — `coverage` prop wired into the view model; closed-destination filtering + `closedNotice` + `handleAssignSuggestion` guard (C05); `lineupHref` computation (C06); new `RoundBoardCommands` command boundary with all five real actions resolved as defaults.
- `src/components/touchline/round-board/round-status-strip.tsx` — new "Eligible players with an opportunity" tile; "Coverage issues" relabeled "Squads below minimum" for accuracy.
- `src/components/touchline/round-board/player-assignment-inspector.tsx` — `closedNotice` and `lineupHref` props/rendering.
- `src/components/touchline/round-board/player-assignment-sheet.tsx` — passes `closedNotice`/`lineupHref` through.
- `src/lib/touchline/presentation/round-board-view-model.ts` — `RoundBoardSummary.eligibleCoverage` field.
- `src/lib/touchline/presentation/round-board-production-adapter.ts` — `eligibleCoverage` threaded into `buildRoundBoardViewModel`; dead `availablePlayerCount` input removed.
- `src/app/dev/ui-lab/atlas-followup/round-board/fixtures.ts` — updated for the `RoundBoardSummary.eligibleCoverage` type addition (pre-existing Gate-D prototype fixture, unrelated to this wave's scenarios).

## Regression tests added for the bounded fixes

- `src/components/round/__tests__/round-board.test.tsx` — eligible-coverage rendering (with/without `coverage`), closed-destination exclusion + `closedNotice`, mixed-boundary destination survival, command-boundary injection/fallback.
- `src/lib/touchline/presentation/__tests__/round-board-production-adapter.test.ts` — `eligibleCoverage` pass-through, kept distinct from squad-placement counts.

## New Gate C W2 candidate infrastructure

- `src/app/dev/ui-lab/gate-c/w2-shared/round-identities.ts` — team/kit/name identities, deterministic roster builder.
- `src/app/dev/ui-lab/gate-c/w2-shared/round-board-fixture-harness.tsx` — the fixture command boundary.
- `src/app/dev/ui-lab/gate-c/c04-planning-open/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c05-planning-closed/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c06-dense-allocation/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/page.tsx` — index updated to list C04-C06.

## Documentation

- `docs/ui-lab/gate-c-w2-candidates/` — this directory (12 files; `capture-attestation.json` to follow once CI's visual-review run completes — see `REVIEW_RECORD.md`).

## Explicitly not touched

- `compute-plan-integrity.ts`'s actual math — only its consumption changed.
- `src/domain/positions/` — no new vocabulary, no schema change.
- Any Gate A/B/C W1 fixture, component, or doc.
- `src/app/dev/ui-lab/gate-c/shared/` (the C01-C03 shared fixtures) — not read from or written to.
