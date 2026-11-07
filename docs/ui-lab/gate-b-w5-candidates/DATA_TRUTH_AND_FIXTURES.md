# Gate B W5 — Data Truth and Fixtures (B08)

One canonical match history (`src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/
fixture.ts` + `fixture-history.ts`) feeds all five lifecycle candidates — never a second
interpretation of the same match. Every number below is asserted by a real test, not restated here
as a separate claim to trust; see the referenced test file for the authoritative check.

## Identity (`fixture.ts`)

- `B08_MATCH_ID` / `B08_REPORT_ID` — one identity throughout all five states.
- Home: the programme's persistent team (`MATCH_B_TEAM_NAME`, shared across Gate B since ADR-0157).
  Opponent: "Vollen IL". Kickoff `2026-11-05T10:00:00.000Z`.
- Format: NFF G11 7v7, 2×30 minutes (60' regulation) — the same authoritative format B05 already
  established; no new duration invented (`CURRENT_STATE_AUDIT.md` §5).
- Five real, fixed, chronologically increasing observation instants (`B08_BEFORE_NOW` ... `B08_COMPLETED_AT`)
  — never `Date.now()`, strictly ordered, checked directly in `shared/__tests__/fixture.test.ts`.
- 8-member squad: 7 starters filling every real G11 7v7 slot, 1 bench reserve (Elias) who attends
  but is never fielded (0 minutes, no unexplained gap).

## Canonical event record (`fixture-history.ts`)

Final result: **2-1** (home win). Three real goal events, in period-relative time
(`globalMinuteToPeriodRelative()`, the same real `period-config.ts` contract B05 uses):

- 10' — Vetle scores, unassisted (1-0).
- 22' — Vollen equalizes (1-1).
- 48' — Noah scores, assisted by Sindre (2-1, final).

Slemmestad never trails and never leads by more than one goal at any point — asserted directly,
not assumed (`shared/__tests__/fixture-history.test.ts`).

## The one genuine incomplete-data condition

The second half's running-clock duration is **unconfirmed** in the DRAFT report
(`b08TimingReview("draft")` → `needsReview: true`, a plausible-but-unreviewed 27' reading) and
resolved to the real 30' period duration in COMPLETED. This is not a decorative warning panel — it
is the real blocker the shared `useSafeReportLifecycle` reducer's own `complete()` action enforces
(confirmed directly against the real reducer code during Step 4 implementation): attempting to
complete the DRAFT report without resolving it is rejected with an explicit error, state unchanged.
There is deliberately **no** goal-attribution gap in this fixture (both report goals exist from the
start) — B05 already demonstrates that axis; B08's own incomplete-data axis is timing, kept
distinct on purpose.

## Report data consistency (DRAFT vs. COMPLETED)

`b08Goals`/`b08Assists`/`b08AttendanceFacts` are identical between variants — finalization does not
silently change goals, attendance, or match identity. The only field that changes between variants
is the timing-review row's own `resolvedDurationMinutes`/`needsReview`, plus the lifecycle-derived
`status`/`completedBy`/`completedAt` fields. Asserted directly in `shared/__tests__/fixture-history.test.ts`.

## Combination evidence

`b08CombinationEvidence` (the Noah/Sindre LCM-RCM partnership behind the 48' winner) is a
hand-written literal — **never computed inline** in this module, since the real
`deriveCombinationsFromSegments()` lives in a server-only module
(`combination-topology.ts`/`combination-aggregation.ts`) that would pull `db`/`pg`/Node builtins
into this page's client bundle if imported by value (the exact real CI `Build` failure class
documented in `CURRENT_STATE_AUDIT.md` §7, already hit once by B05). The literal is independently
verified byte-for-byte (except the non-deterministic `createdAt` stamp) against the real function's
own output for the same input, in `shared/__tests__/combination-evidence.test.ts` — mirroring B05's
own `combination-evidence.test.ts` exactly.

## Test coverage summary

| File | Tests | What it proves |
|---|---|---|
| `shared/__tests__/fixture.test.ts` | part of 46 | Stable identity, chronological ordering of the five observation instants, format consistency. |
| `shared/__tests__/fixture-history.test.ts` | part of 46 | Score-to-goal-event consistency, DRAFT/COMPLETED data parity, the timing-review gap's shape. |
| `shared/__tests__/combination-evidence.test.ts` | part of 46 | The hand-written combination-evidence literal matches the real derivation function's output. |

Full run: `npx vitest run src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__` →
**3 files, 46 tests, all passing** (re-verified in this session).
