# Gate C W2 — Changed Files

Covers both the initial implementation and the independent-review remediation pass (findings P1-01 through P1-07).

## Production fixes (bounded, acceptance-contract-required — see `CURRENT_STATE_AUDIT.md`)

- `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx` — forwards `integrity.coverage`; forwards `playerId`/`matchId`/`idempotencyKey` through the warnings mapping (P1-04), resolving `playerName` from already-fetched data.
- `src/components/round/round-board.tsx` — `coverage` prop; closed-destination filtering + `closedNotice` (now also proactive when the player's own current match is closed) + `handleAssignSuggestion` guard (C05); `lineupHref` computation (C06); `RoundBoardCommands` command boundary including `setCoachingIntent`/`removeCoachingIntent` (P1-06); `movePlayerToMatch` now checks both source and destination boundaries and returns a `MoveOutcome` instead of void (P1-03/P1-05); every caller of it branches on that outcome; a shared `assignmentError` state and its two display surfaces (inline in the inspector/sheet, a top-level banner otherwise); `disableClearAndRegenerate` prop; `onResolve` routing extended for match-only items.
- `src/components/touchline/round-board/round-board-rail.tsx` — renders the Resolve control only when `item.resolvable` (P1-01), not merely when `onResolve` is provided.
- `src/components/touchline/round-board/round-status-strip.tsx` — new "Eligible players with an opportunity" tile; "Coverage issues" relabeled "Squads below minimum".
- `src/components/touchline/round-board/player-assignment-inspector.tsx` — `closedNotice`, `lineupHref`, and `errorNotice` props/rendering.
- `src/components/touchline/round-board/player-assignment-sheet.tsx` — passes `closedNotice`/`lineupHref`/`errorNotice` through.
- `src/components/matches/coaching-intent-selector.tsx` — `setCoachingIntentCommand`/`removeCoachingIntentCommand` optional props, defaulting to the real dynamic imports (P1-06).
- `src/lib/touchline/presentation/round-board-view-model.ts` — `RoundBoardSummary.eligibleCoverage`; `RoundBoardAttentionItem.resolvable` (P1-01).
- `src/lib/touchline/presentation/round-board-production-adapter.ts` — `eligibleCoverage` threaded through; dead `availablePlayerCount` input removed; `resolvable` computed from per-match boundary data (P1-01).
- `src/app/dev/ui-lab/atlas-followup/round-board/fixtures.ts` — updated for the `eligibleCoverage`/`resolvable` type additions (pre-existing Gate-D prototype fixture, unrelated to this wave's scenarios).

## Regression tests added/updated for the bounded fixes

- `src/components/round/__tests__/round-board.test.tsx` — eligible-coverage rendering, closed-destination exclusion + proactive source-closed notice, mixed-boundary destination survival, command-boundary injection/fallback, source-boundary enforcement via the matrix and suggestion-card paths (P1-03), truthful rejection/partial-error feedback on desktop and the mobile sheet (P1-05).
- `src/components/touchline/round-board/__tests__/round-board-rail.test.tsx` — `resolvable: false` never renders Resolve even with `onResolve` provided; `resolvable: true` renders it and calls through (P1-01).
- `src/lib/touchline/presentation/__tests__/round-board-production-adapter.test.ts` — `eligibleCoverage` pass-through; `resolvable` computed correctly for player-specific, match-specific, and identity-less attention items (P1-01).

## New Gate C W2 candidate infrastructure

- `src/app/dev/ui-lab/gate-c/w2-shared/round-identities.ts` — team/kit/name identities, deterministic roster builder (per-team `nameOffset` fixes a real cross-team name-collision defect found while building C06).
- `src/app/dev/ui-lab/gate-c/w2-shared/round-board-fixture-harness.tsx` — the fixture command boundary, including the coaching-intent and Clear/Regenerate seams added during remediation.
- `src/app/dev/ui-lab/gate-c/c04-planning-open/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c05-planning-closed/{fixtures.ts, page.tsx, __tests__/page.test.tsx}` — `fixtures.ts`'s historical warning corrected from `SELECTED_PLAYER_UNAVAILABLE` to `SQUAD_BELOW_MINIMUM` (P1-02); two new edge-case fixtures (open-match-only warning, insufficient-identity warning).
- `src/app/dev/ui-lab/gate-c/c06-dense-allocation/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c06-dense-allocation/denied-assignment/page.tsx` — new route exposing the denied-assignment fixture as a genuinely reachable browser-testable page (P1-07).
- `src/app/dev/ui-lab/gate-c/page.tsx` — index updated to list C04-C06.

## Browser acceptance evidence (P1-07)

- `scripts/ui-lab-visual-review.mjs` — registers all four new routes (C04, C05, C06, and the denied-assignment sub-route) in the CI capture pipeline, with mobile-aware "select a player" interactions (`selectPlayerGateCW2`) that drill into the compact match-first composition the same way a real coach would, and a visibility-checked Allocation-toggle interaction that is a safe no-op below the `medium` breakpoint rather than a doomed `.click()`.
- `e2e/ui-lab-gate-c.spec.ts` — 29 new real-Chromium Playwright tests: C04's coverage denominator and actionable identity (desktop + mobile drill-in), C05's Resolve gating and read-only closed-match selection (desktop + mobile), C06's dense matrix interaction, the mobile assignment sheet, a genuinely denied assignment, and that no mutation-capable control reaches a real `next-action` request; plus a dedicated Gate C W2 responsive-overflow suite.

## Documentation

- `docs/ui-lab/gate-c-w2-candidates/` — updated in place to reflect the remediation pass (see `REVIEW_RECORD.md` for the full finding-by-finding disposition).

## Explicitly not touched

- `compute-plan-integrity.ts`'s actual math — only its consumption changed.
- `src/domain/positions/` — no new vocabulary, no schema change.
- Any Gate A/B/C W1 fixture, component, or doc.
- `src/app/dev/ui-lab/gate-c/shared/` (the C01-C03 shared fixtures) — not read from or written to.
- Any server-side transaction/atomicity behavior for the existing assignment actions (the partial-completion risk between add and remove is surfaced truthfully, not redesigned — explicitly out of scope per the remediation brief).
