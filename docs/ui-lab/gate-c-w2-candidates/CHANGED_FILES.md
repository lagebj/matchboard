# Gate C W2 — Changed Files

Covers the initial implementation and both independent-review remediation passes (findings P1-01 through P1-07, then the second pass's four further findings).

## Production fixes (bounded, acceptance-contract-required — see `CURRENT_STATE_AUDIT.md`)

- `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx` — forwards `integrity.coverage`; forwards `playerId`/`matchId`/`idempotencyKey` through the warnings mapping (P1-04), resolving `playerName` from already-fetched data.
- `src/components/round/round-board.tsx` — `coverage` prop; closed-destination filtering + `closedNotice` (now also proactive when the player's own current match is closed) + `handleAssignSuggestion` guard (C05); `lineupHref` computation (C06); `RoundBoardCommands` command boundary including `setCoachingIntent`/`removeCoachingIntent` (P1-06); `movePlayerToMatch` now checks both source and destination boundaries and returns a `MoveOutcome` instead of void (P1-03/P1-05); every caller of it branches on that outcome; a shared `assignmentError` state and its two display surfaces (inline in the inspector/sheet, a top-level banner otherwise); `disableClearAndRegenerate` prop; `onResolve` routing extended for match-only items. **Second remediation pass**: new `handleResolveMatch` callback gives match-specific Resolve a real desktop effect (scrolls the lane into view, focuses a real control inside it); `closedMatchCount`/`allMatchesClosed`/`mixedPlanningBoundary` derived state splits the boundary banner into mixed/fully-closed/empty-round branches instead of one all-or-nothing message; `otherMatchesForPicker`/`moveDestinations`/`otherMatchesExistButClosed` filter the desktop Move picker to genuinely open destinations with an accurate empty-state message.
- `src/components/touchline/round-board/round-board-rail.tsx` — renders the Resolve control only when `item.resolvable` (P1-01), not merely when `onResolve` is provided.
- `src/components/touchline/round-board/round-status-strip.tsx` — new "Eligible players with an opportunity" tile; "Coverage issues" relabeled "Squads below minimum".
- `src/components/touchline/round-board/player-assignment-inspector.tsx` — `closedNotice`, `lineupHref`, and `errorNotice` props/rendering.
- `src/components/touchline/round-board/player-assignment-sheet.tsx` — passes `closedNotice`/`lineupHref`/`errorNotice` through.
- `src/components/matches/coaching-intent-selector.tsx` — `setCoachingIntentCommand`/`removeCoachingIntentCommand` optional props, defaulting to the real dynamic imports (P1-06).
- `src/lib/touchline/presentation/round-board-view-model.ts` — `RoundBoardSummary.eligibleCoverage`; `RoundBoardAttentionItem.resolvable` (P1-01).
- `src/lib/touchline/presentation/round-board-production-adapter.ts` — `eligibleCoverage` threaded through; dead `availablePlayerCount` input removed; `resolvable` computed from per-match boundary data (P1-01). **Second remediation pass**: `isResolvable` now resolves the signal's own player's current match first and fails closed if that match is not open, before considering any other match — the first pass's fix only checked whether *some other* match was open.
- `src/app/dev/ui-lab/atlas-followup/round-board/fixtures.ts` — updated for the `eligibleCoverage`/`resolvable` type additions (pre-existing Gate-D prototype fixture, unrelated to this wave's scenarios).

## Regression tests added/updated for the bounded fixes

- `src/components/round/__tests__/round-board.test.tsx` — eligible-coverage rendering, closed-destination exclusion + proactive source-closed notice, mixed-boundary destination survival, command-boundary injection/fallback, source-boundary enforcement via the matrix and suggestion-card paths (P1-03), truthful rejection/partial-error feedback on desktop and the mobile sheet (P1-05). **Second remediation pass** (+8 tests): the mixed-vs-fully-closed-vs-empty-round banner (3 tests), the Move picker excluding closed destinations (3 tests), match-specific Resolve's real desktop effect (2 tests).
- `src/components/touchline/round-board/__tests__/round-board-rail.test.tsx` — `resolvable: false` never renders Resolve even with `onResolve` provided; `resolvable: true` renders it and calls through (P1-01).
- `src/lib/touchline/presentation/__tests__/round-board-production-adapter.test.ts` — `eligibleCoverage` pass-through; `resolvable` computed correctly for player-specific, match-specific, and identity-less attention items (P1-01). **Second remediation pass** (+5 tests): the full player-own-match-closed decision matrix, including the flipped case the first pass's tests never encoded.

## New Gate C W2 candidate infrastructure

- `src/app/dev/ui-lab/gate-c/w2-shared/round-identities.ts` — team/kit/name identities, deterministic roster builder (per-team `nameOffset` fixes a real cross-team name-collision defect found while building C06).
- `src/app/dev/ui-lab/gate-c/w2-shared/round-board-fixture-harness.tsx` — the fixture command boundary, including the coaching-intent and Clear/Regenerate seams added during remediation.
- `src/app/dev/ui-lab/gate-c/c04-planning-open/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c05-planning-closed/{fixtures.ts, page.tsx, __tests__/page.test.tsx}` — `fixtures.ts`'s historical warning corrected from `SELECTED_PLAYER_UNAVAILABLE` to `SQUAD_BELOW_MINIMUM` (P1-02); two new edge-case fixtures (open-match-only warning, insufficient-identity warning).
- `src/app/dev/ui-lab/gate-c/c05-planning-closed/open-match-warning/page.tsx` — new route (second remediation pass) exposing `buildC05OpenMatchWarningFixture` as its own genuinely reachable page, specifically so match-specific Resolve's new desktop effect (scroll + focus) is browser-testable, not just component-test-only — the primary C05 fixture's own match-only warning sits on an already-closed match where no action should be offered at all.
- `src/app/dev/ui-lab/gate-c/c06-dense-allocation/{fixtures.ts, page.tsx, __tests__/page.test.tsx}`
- `src/app/dev/ui-lab/gate-c/c06-dense-allocation/denied-assignment/page.tsx` — new route exposing the denied-assignment fixture as a genuinely reachable browser-testable page (P1-07).
- `src/app/dev/ui-lab/gate-c/page.tsx` — index updated to list C04-C06.

## Browser acceptance evidence (P1-07, extended in the second remediation pass)

- `scripts/ui-lab-visual-review.mjs` — registers all four new routes (C04, C05, C06, and the denied-assignment sub-route) in the CI capture pipeline, with mobile-aware "select a player" interactions (`selectPlayerGateCW2`) that drill into the compact match-first composition the same way a real coach would, and a visibility-checked Allocation-toggle interaction that is a safe no-op below the `medium` breakpoint rather than a doomed `.click()`. **Second remediation pass**: registers the new `gate-c-w2-c05-open-match-warning` route (`clickByName("Resolve")` interaction) and adds a third, cumulative "Move Markus to..." interaction to the primary C05 registration.
- `e2e/ui-lab-gate-c.spec.ts` — 29 new real-Chromium Playwright tests: C04's coverage denominator and actionable identity (desktop + mobile drill-in), C05's Resolve gating and read-only closed-match selection (desktop + mobile), C06's dense matrix interaction, the mobile assignment sheet, a genuinely denied assignment, and that no mutation-capable control reaches a real `next-action` request; plus a dedicated Gate C W2 responsive-overflow suite. **Second remediation pass** (+2 tests): a desktop test that a match-specific Resolve on an OPEN match scrolls that lane into view and moves focus to a real control inside it; a desktop test that the Move picker excludes a closed match and explains why. Also corrected the existing C05 banner assertion (previously asserted the old all-or-nothing "every match's planning boundary has closed" wording, which no longer matches C05's genuinely mixed fixture) to assert the new mixed-specific wording instead.

## Documentation

- `docs/ui-lab/gate-c-w2-candidates/` — updated in place to reflect both remediation passes (see `REVIEW_RECORD.md` for the full finding-by-finding disposition).

## Explicitly not touched

- `compute-plan-integrity.ts`'s actual math — only its consumption changed.
- `src/domain/positions/` — no new vocabulary, no schema change.
- Any Gate A/B/C W1 fixture, component, or doc.
- `src/app/dev/ui-lab/gate-c/shared/` (the C01-C03 shared fixtures) — not read from or written to.
- Any server-side transaction/atomicity behavior for the existing assignment actions (the partial-completion risk between add and remove is surfaced truthfully, not redesigned — explicitly out of scope per the remediation brief).
- The pre-existing ~600-1200px Round Board desktop-grid layout gap — disclosed, not fixed; filed as a separately tracked defect instead: https://github.com/lagebj/matchboard/issues/830.
