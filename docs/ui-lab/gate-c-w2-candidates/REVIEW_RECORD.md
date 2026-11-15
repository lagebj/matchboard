# Gate C W2 — Review Record

## Summary

Three candidates (C04, C05, C06 — plus a dedicated denied-assignment route for C06) built against the real, unmodified `RoundBoard` production component tree, via a fixture command boundary that never touches a live database mutation. The initial implementation found and fixed two real production defects (eligible-coverage data never surfaced; a closed match could still accept an assignment from the inspector/sheet) and correctly disclosed C06's position-precision gap as `BLOCKED_BY_SOURCE_OR_AUTHORITY` rather than fabricating it.

An independent review of that implementation found seven further findings (P1-01 through P1-07). All seven are fixed in this pass, verified with real browser tests in addition to component tests, and documented below finding-by-finding.

## Finding dispositions

| Finding | Root cause | Fix | Tests |
|---|---|---|---|
| P1-01 — false Resolve action | `RoundBoardRail` rendered "Resolve" for every attention item whenever `onResolve` existed, with no per-item boundary check | `RoundBoardAttentionItem.resolvable`, computed in the production adapter from per-match `isFinalized` data; the rail renders Resolve only when it's `true`; routing extended for match-only items | `round-board-rail.test.tsx` (resolvable true/false), `round-board-production-adapter.test.ts` (player-specific/match-specific/identity-less cases), `ui-lab-gate-c.spec.ts` (real browser) |
| P1-02 — C05 warning not producible by the real engine | The fixture used `SELECTED_PLAYER_UNAVAILABLE`, which `compute-plan-integrity.ts` only emits for `DRAFT` selections — impossible on a finalized match | Replaced with `SQUAD_BELOW_MINIMUM`, which the engine evaluates for every non-cancelled match (draft + finalized) regardless of boundary | `c05-planning-closed/__tests__/page.test.tsx`, `ui-lab-gate-c.spec.ts` |
| P1-03 — source boundary unguarded | `movePlayerToMatch` removed a player from `fromMatchId` unconditionally once the add succeeded — no check that the source match was still open | `movePlayerToMatch` now checks both source and destination before acting; the suggestion-card path additionally stops *offering* a destination at all when the player's own match is closed | `round-board.test.tsx` (matrix + suggestion-card paths), `ui-lab-gate-c.spec.ts` |
| P1-04 — dropped signal identity | `page.tsx`'s warning mapping dropped `playerId`/`matchId`/`idempotencyKey`; `attentionItems` hardcoded `matchId: null` and an index-derived `id` | Both fields threaded through from the canonical signal; `playerName` resolved from already-fetched data | Covered by every P1-01 test exercising a match-specific item, which requires `matchId` to survive the mapping |
| P1-05 — no truthful rejection feedback | `movePlayerToMatch` returned void; every caller refreshed/closed unconditionally regardless of the server result | Returns a `MoveOutcome`; callers branch on it; a shared `assignmentError` surface (inline in the inspector/sheet, a banner otherwise); a partial-completion risk (add succeeds, remove fails) is surfaced as an explicit error | `round-board.test.tsx` (rejected, partial-error, and success paths; desktop + mobile sheet), `ui-lab-gate-c.spec.ts` (denied-assignment route) |
| P1-06 — incomplete command isolation | `CoachingIntentSelector` dynamically imports its own real server actions, outside `RoundBoardCommands`; Clear/Regenerate no-ops returned success despite doing nothing | Two new command props on `CoachingIntentSelector`, threaded through `MatchLane`; Clear/Regenerate disabled outright in UI Lab (`disableClearAndRegenerate`) rather than faking success | `ui-lab-gate-c.spec.ts` ("no mutation-capable control reaches a real server action") |
| P1-07 — missing browser evidence | `scripts/ui-lab-visual-review.mjs` never registered the three new routes; no Playwright acceptance tests existed for C04-C06 | All four routes (including a new denied-assignment sub-route) registered with mobile-aware interactions; 29 new real-Chromium tests in `e2e/ui-lab-gate-c.spec.ts` | Run locally against `next dev` (91/91 passing, including the 62 pre-existing W1 tests) |

No finding required deviating from the brief's hard constraints: no schema change, no new selection engine, no transaction redesign, no new position vocabulary, and the C06 position-precision disclosure (`BLOCKED_BY_SOURCE_OR_AUTHORITY`) stands unchanged — see `POSITION_VOCABULARY_AND_PRECISION.md`.

## Local verification performed (this pass)

- `npm run typecheck`, `npm run lint` — clean (the three pre-existing `compute-plan-integrity.ts` warnings are untouched by this diff).
- `npm test` (both vitest configs) — 593 + 166 test files, 6579 + 1079 tests, all passed.
- `npm run build` — succeeded; all four new routes (including `c06-dense-allocation/denied-assignment`) compiled and are listed in the route manifest.
- `npm run validate -- --fast` — all 13 steps passed.
- **`npx playwright test --project=ui-lab-gate-c` against a local `next dev` server — 91/91 passed** (62 pre-existing Gate C W1 tests + 29 new Gate C W2 tests), including responsive-overflow, console-error, and network-isolation (`next-action` header) assertions. A prior assumption that this devcontainer cannot run real Chromium Playwright against `next dev` did not hold for this session — corrected in project memory rather than repeated.
- A genuine pre-existing layout gap was found and disclosed, not fixed, while writing the new responsive-overflow tests: Round Board's desktop grid has no safe width between its compact breakpoint (~840px) and ~1200px, reproduced identically on the untouched `atlas-followup/round-board` prototype — see `BLOCKERS_AND_KNOWN_LIMITATIONS.md`.

## Disposition

**READY_FOR_INDEPENDENT_REVIEW.**

`capture-attestation.json` is intentionally not included in this commit — it must be generated by CI's `ui-lab-visual-review.yml` against this PR's real branch-tip commit (real Chromium, real SHA-256 hashes), per ADR-0159. It will be added once that workflow run completes. Local Playwright runs in this session prove the interactions and assertions are sound; they are not a substitute for CI's independently-produced evidence, by design.
