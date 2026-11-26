# Gate E W1 — Data Truth and Fixtures

## Fixture identity

Both fixtures follow the shared `FixtureIdentity` contract
(`src/app/dev/ui-lab/gate-a/shared/fixture-identity.ts`): `sourceClass: "SYNTHETIC_LABELED"`, a
fixed `fixedDateTimeUtc`, `viewerTimeZone: "Europe/Oslo"`, `locale: "en-GB"`, and a
`fixtureSha256` independently recomputed by each fixture's own test — never hand-typed as the
expectation (`fixtures.test.ts` computes it via `createHash("sha256").update(JSON.stringify(rawRecordsForHash))`
and asserts it against the literal in `fixtures.ts`; the literal was itself produced by running
that same computation once and copying the result in, not invented).

## No `Date.now()` — fixed anchor, real classification

Both fixtures compute every kickoff date as a fixed-day offset from one frozen anchor instant
(`ANCHOR = new Date("2027-03-15T09:00:00.000Z")`), never the real clock. The *same* `ANCHOR` value
is passed as `now` to `buildLeagueOperatingViewModel()` in both the page and every test — so the
real production temporal-classification logic (`classifyTemporal()`, `closureStateOf()`,
`attentionLevelOf()`, `resolveDefaultFocus()`) decides CURRENT/PAST/FUTURE/closure/attention from
the fixture's own dates, and nothing here hand-asserts a classification outcome that the real code
didn't actually produce. `fixtures.test.ts` for both states independently verifies this by calling
the real function and checking its output, not by trusting the fixture author's intent.

## `GATE-E-W1-E01-MID-SEASON` — reconciliation

Two `FixturePeriod`s, eight rounds, eleven matches:

- **Spring 2027** (current period, `isCurrent: true`): Round 6 (`ANCHOR-21d`, FINAL, 1 match,
  done) → pushed into the collapsed "earlier rounds" disclosure (verified:
  `vm.earlierRounds` contains it, `vm.recentRounds` does not). Round 7 (`ANCHOR-14d`, FINAL): one
  `done` match (6–4, matching the programme's own "6–4/one recorded event" convention — the result
  here is a real recorded completed match, not the sparse-coverage case, which E01 does not need)
  and one **cancelled** match, verifying cancelled matches are excluded from closure computation
  (`activeMatches()` filters them out) and never rendered as a result. Round 8 (`ANCHOR-7d`,
  NEEDS_CLOSURE): one `played`/report-missing match — the real "most recent round still needing
  closure" candidate. Round 9 (`ANCHOR+0d`, **CURRENT**): two matches, one carrying a real
  `BLOCKED`/`SQUAD_BELOW_MINIMUM` planning signal, one with `lineupState: "MISSING"`
  (TACTICS_MISSING) — verifying the round's `CURRENT_ROUND` status label is never replaced by its
  own real attention count (`league-focused-round.tsx`'s own documented invariant). Round 10
  (`ANCHOR+7d`, FUTURE, `NOT_GENERATED`): one match, `lineupState: "MISSING"`. Round 11
  (`ANCHOR+21d`, FUTURE, `READY`): one match, `lineupState: "PREPARED"`. Rounds 10 and 11 are
  separated by one genuinely empty rail week (`ANCHOR+14d`, no round) — verified directly against
  `vm.railSlots`.
- **Autumn 2026** (`isCurrent: false`): Round 1 (`ANCHOR-190d`, FINAL, done, 3–0) and Round 2
  (`ANCHOR-180d`, NEEDS_CLOSURE, played/report-missing). Switching to this period must re-resolve
  focus to Round 2 (its own most-recent-needing-closure round), never carry over Spring's Round 9
  — verified directly in `fixtures.test.ts`.

Every round/match total, status, and rail-slot classification asserted in `fixtures.test.ts` is
the real output of `buildLeagueOperatingViewModel()` run against this exact fixture data, not an
independently-typed expectation.

## `GATE-E-W1-E01-SEASON-CLOSED` — reconciliation

One `FixturePeriod` ("Autumn 2026", `isCurrent: false`), three rounds, all in the past relative to
`ANCHOR`: Round 1 (`ANCHOR-60d`, FINAL, 1–3), Round 2 (`ANCHOR-50d`, NEEDS_CLOSURE,
played/report-missing), Round 3 (`ANCHOR-40d`, FINAL, 2–2). With no CURRENT and no FUTURE round
anywhere, `resolveDefaultFocus()`'s real fallback chain lands on the most recent round still
needing closure (Round 2) — never the most recent round overall (Round 3, which is FINAL) and
never a fabricated "current" round. Verified directly in `fixtures.test.ts`.

## Source/units/coverage

- Scores are whole-number `goalsFor`/`goalsAgainst` with a `displayScore` and `outcome` derived
  consistently (no reverse-engineered events — this wave does not use the sparse-event-coverage
  case at all, since E01's acceptance question is about round/period temporal orientation, not
  event-chronology density; that is XR-T02's concern, out of this wave's scope).
  "report missing"/"needs closure" rounds carry `reportState: { state: "NO_REPORT" }`, never a
  fabricated zero score.
- `teamKitColor` is a plain hex string on every match, consistent with the real
  `Team.kitColor`/`resolveKitColorSwatch()` contract (ADR-0144) — no second colour model.
- `planningSignals`/`roundLevelPlanningSignals` use the real `FixturePlanningSignal` shape
  (`idempotencyKey`, `kind`, `ruleCode`, `title`, `currentState`, `consequence`,
  `primaryActionLabel`, `primaryActionTarget`), with `matchId`/`teamId` set only where the
  ownership is truthful (ADR-0144 "signal ownership" rule) — Round 9's BLOCKED signal is
  match-owned (`matchId` set), never a round-level signal misattributed to a specific match.

## Reconciliation checklist (per `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` §"Fixture validity")

1. Every displayed state (current/past/future, FINAL/NEEDS_CLOSURE, attention) is produced by the
   real `buildLeagueOperatingViewModel()`, verified by `fixtures.test.ts` calling it directly —
   not hand-asserted.
2. Every referenced id (`teamId`, round/match ids) is internally consistent within its own
   fixture; no cross-fixture id reuse.
3. Dates are monotonic offsets from one frozen anchor; ordering (PAST < CURRENT < FUTURE) is
   real-code-verified, not asserted by fiat.
4. No displayed total (rail slot counts, attention counts) is a hand-typed literal independent of
   the source records — `fixtures.test.ts` reads them off the real view-model output.
5. Rates/units: none introduced in E01 (no minutes/percentages here — out of this wave's scope).
6. Derived counts (`attentionCount`, `reportsIncompleteCount`) are never presented as raw facts —
   they are the real view model's own derived fields, shown as the real component already shows
   them, not re-derived independently in the fixture or test.
7. Missing evidence stays missing: the NEEDS_CLOSURE rounds use `reportState: { state: "NO_REPORT" }`,
   never a zero score.
8. No cross-team or cross-player claim exists anywhere in E01 (League operates at round/match
   granularity only).
9. The season-closed state is genuinely empty of any current/future round — not merely narrated as
   such.
10. No error state exists in this wave (E01 has no error/failure case in its register row); not
    conflated with the season-closed state, which is a real, valid "no current round" condition,
    not an error.
