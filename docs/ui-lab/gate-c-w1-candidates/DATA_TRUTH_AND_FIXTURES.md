# Gate C W1 — Data Truth and Fixtures

All fixtures live under `src/app/dev/ui-lab/gate-c/` and are built directly against the real
production type contracts and adapters — not ad hoc objects shaped only to look right visually.
`npm run typecheck` verifies every fixture against the real types.

## One controlled clock (P2-01 remediation, independent review of PR #826)

`TodaySurface` now accepts an explicit `nowIso?: string` prop (preserving exact production
behavior when omitted — production's own `today/page.tsx` does not pass it). Every Gate C
scenario passes the same fixed reference instant, `GATE_C_NOW_ISO = "2026-11-10T14:00:00.000Z"`
(a Tuesday, 15:00 Oslo/CET — comfortably midday, far from any local-date boundary), exported from
`shared/fixtures.ts`. This replaced an earlier design that computed kickoff offsets from the real
`Date.now()` at request time: that approach genuinely avoided a hydration mismatch (server vs.
client evaluating `Date.now()` moments apart) but still left two real gaps the independent review
found — C01's hardcoded absolute upcoming-match dates (2026-11-14/21) would silently fall outside
production's real 7-day window once evaluated after 2026-11-14, and nothing proved fixture phase
selection independently of the developer machine's clock. A fixed, explicit reference instant
closes both gaps outright: `src/app/dev/ui-lab/gate-c/shared/__tests__/fixtures.test.ts` proves
every phase/source combination resolves to its intended `TodayMatchdayPhase` via the real
`resolveTodayMatchdayPhase()`, that two fixture-builder calls are byte-identical (determinism),
and that every same-day candidate match falls on the real Europe/Oslo calendar day (via the real
`getDisplayDateKey()`) — and `c01-quiet-day/__tests__/page.test.tsx` proves every upcoming-match
kickoff date is genuinely within the 7-day window, independent of when the test runs.

## Real same-day match selection, not a hand-picked featured match (P1-02 remediation)

`gateCBuildBusyDay()` (`shared/fixtures.ts`) builds three same-day candidates — one already
finished earlier today (needs its report), one later today (lower priority), and one at the
phase-appropriate kickoff offset — and adapts each through the **real** production functions
(`leagueMatchToTodayFootballMatch()`, `eventMatchToTodayFootballMatch()`). The real
`selectFeaturedTodayFootballMatch()` — never this fixture — decides which one is featured. This
is deliberately a genuinely busy day (three real candidates), not a day with only one match to
begin with, so the real selector's own priority logic is actually exercised rather than bypassed.

## Organisation-scoped URLs (P2-02 remediation)

Every fixture href now follows production's real scoping rules, verified field-by-field against
each consuming component (some components apply `orgUrl()` themselves and expect an unscoped
path — e.g. `PlanIntegritySignal.primaryActionTarget`; others render the href directly and expect
it pre-scoped — e.g. `TodaySelectionDecision.roundBoardHref`, `AssistantWorkItem.primaryActionHref`,
`MatchPresentation.href`, `TodayCarryForwardItem.href`). `gateCOrgUrl()` (`shared/fixtures.ts`)
mirrors `useOrgUrl()`'s real `/o/{slug}${path}` convention exactly; the real adapters
(`leagueMatchToTodayFootballMatch()`/`eventMatchToTodayFootballMatch()`) call it internally for
C03's matchday hrefs, so those were never hand-scoped at all. `e2e/ui-lab-gate-c.spec.ts` proves
three separate things an href assertion alone cannot: the href has the correct canonical shape,
the link is actually clicked, and a real destination is reached — verified empirically (request/
response logging, not assumed) to be a genuine `307 -> /signin` redirect chain, since these are
real auth-gated production routes with synthetic ids and `/dev/ui-lab` carries no session.

## A genuine identity collision, not just a count cap (P2-03 remediation)

C02's primary decision (`primarySelectionDecision`) and a raw `PlanIntegritySignal`
(`primarySignal`) in `roundPlanIntegrities` share the exact same real identity (`signalKey` ==
`idempotencyKey`) — the real production coupling: a `TodaySelectionDecision` is always built from
an `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` signal with the same key.
`resolveTodayPrimaryAction()`'s own step 1 (never re-implemented in this fixture) resolves this to
a `SELECTION_DECISION` primary action; `today-surface.tsx`'s own existing
`remainingSelectionDecisions` filter (never a new dedup algorithm written for this fixture) is
what must keep this exact decision from also appearing in the secondary Selection decisions list.
A second, independent `secondarySelectionDecision` (a different player, a different signalKey)
proves a genuinely different decision still renders — this is not merely "nothing else was passed
in," which the original W1 fixture's count-cap-only test could not distinguish from real
suppression.

## Correct player availability and plan-integrity signals

C02's secondary planning-attention signal and C03's VERIFY-phase readiness use real `ruleCode`
and `SelectedPlayerAvailabilityState` values, not invented categories.

## No invented coaching observations or AI conclusions

No fixture in this wave includes a coach observation or an Assistant Coach hypothesis — see
`THREE_PART_EXPERIENCE_CONTRACT.md` for why that is correct, not an omission.

## Tactics readiness

Every C03 fixture sets `tactics.state: "UNKNOWN"` for both League and Event, deliberately — there
is no canonical, distinctly-persisted tactics record in the domain model to invent a value from
(D7), and Event has no tactics data source at all. `resolveTodayMatchdayAction()`'s
`MISSING_TACTICS` branch is not exercised by this wave's fixtures; that is an accepted, disclosed
gap (see `BLOCKERS.md`), not a defect.

## Internal consistency and determinism

`gateCBaseCommandCentre()` and `gateCBuildBusyDay()` are the one place each fixture's base facts
are constructed, reused by every scenario rather than duplicated. Every timestamp traces back to
the one `GATE_C_NOW_ISO` constant — no scenario reads the real wall clock or `Math.random()`.

## Scenario isolation

None of C01-C03's fixtures write to browser storage, and the pages render from static,
request-independent fixture data only (no server action, no database). The one place Today's
production components read `localStorage` at all — `TodaySelectionDecisions`'s per-decision
dismissal state — is keyed by a `scope` prop this wave does not set (defaults to `"default"`,
the same as production when no scope is supplied); no interaction test in this wave exercises
dismissal, and each Playwright test already gets its own fresh, isolated browser context by
default.
