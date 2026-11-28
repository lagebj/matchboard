# Gate E W2 — Data Truth and Fixtures (E02)

## Fixture identity

Each fixture (`src/app/dev/ui-lab/gate-e/e02-event-day/{upcoming,mixed-progression,completed}/fixtures.ts`)
exports a `FixtureIdentity` (`src/app/dev/ui-lab/gate-a/shared/fixture-identity.ts`):

| Scenario | fixtureId | Version | fixtureSha256 | Reference instant (UTC) |
|---|---|---|---|---|
| `GATE-E-W2-E02-UPCOMING` | `gate-e-w2-e02-upcoming` | 2 | `11a8e5739501cd37d634a0d2cd819932d023ecf2e4e3f01686ab48b990aa9048` | 2027-03-13T07:00:00.000Z |
| `GATE-E-W2-E02-MIXED` | `gate-e-w2-e02-mixed-progression` | 2 | `170bef84703db1e6556cee5655bdc21639977062b9c9d222c9ddb3a11a5d56dd` | 2027-03-13T10:30:00.000Z |
| `GATE-E-W2-E02-COMPLETED` | `gate-e-w2-e02-completed` | 2 | `e2411bbe28ebcb66b4ebc6aaff76ad8ebc926401005ed3310e1a00f5dfa0a57f` | 2027-03-13T17:00:00.000Z |

Version history: v1 (commits `d2440895`–`9d199096`) used three unrelated schedules with distinct
Event/squad/match ids per fixture. v2 (independent review M1) makes all three the same Event day
observed at three instants, so the same match can be compared across lifecycle (XR-S01). Every
hash was recomputed for v2; no v1 hash is reused.

All: `sourceClass: SYNTHETIC_LABELED`, `viewerTimeZone: Europe/Oslo`, `locale: en-GB`. Each
`fixtureSha256` is SHA-256 of `JSON.stringify(rawRecordsForHash)` (`{scenario, now, event, squads,
matches, liveSessions}`). The literals were produced by running that computation once in this
session (the test's own failure output printed the recomputed value); `fixture-integrity.test.ts`
recomputes the hash on every run, so any later edit to a fixture record fails until the version is
bumped and the hash recomputed. All names (club "Fjellsiden", opponents "Nordbyen FK", "Kvisten
IL", "Sjøvik SK", "Bakkely IF", event "Fjellsiden Vårcup") are fictional.

## Record shapes — no alternative domain model

- Matches are canonical `EventMatchWithReport` records (the type `listEventMatchesAction()` returns),
  plus the real `EventMatch.eventId` column so parent membership is testable.
- `isLive`/`livePrimaryAction` are derived from a canonical live-session record
  (`{eventMatchId, status, clockPeriod, clockRunning}`) by `deriveLiveFields()`, which calls the
  same pure `resolveLiveReportingPrimaryAction()` over `getEventPeriodConfig(null, 2, null)` that
  production's private `deriveEventLiveState()` uses for a session without a format snapshot. The
  MIXED live match resolves to `END_PERIOD` "End first half" → entry label "Continue live reporting".
- `location`, `notes` and `opponentTeamId` are `null` on every match: no venue, pitch or canonical
  opponent link is invented. The Event carries only real `Event` columns.
- Every wall-clock time is written with its explicit `+01:00` offset (`osloOn()`); 13 Mar 2027 is
  before the 28 Mar 2027 DST change, which the integrity test asserts.

## The fixed clock

Each fixture exports one `now`. The page passes it to `buildEventDayProjection()`, and every test
uses the same value. No fixture, projection or component calls `Date.now()` or `new Date()` for
classification (`new Date(...)` appears only with literal ISO strings). A projection test confirms
that changing only `now` (UPCOMING at 09:10) changes the classification.

## One Event day, three observation instants

`shared/event-day-schedule.ts` fixes the Event, both squads and the nine matches (ids
`gate-e-w2-e02-m01`…`m09`, squad, opponent, kickoff). Each fixture adds only what had been recorded
by its reference instant:

| Match | Squad v opponent | 08:00 (UPCOMING) | 11:30 (MIXED) | 18:00 (COMPLETED) |
|---|---|---|---|---|
| m01 09:00 | Blå v Nordbyen FK | scheduled | LOCKED 3–1 | LOCKED 3–1 |
| m02 09:00 | Rød v Kvisten IL | scheduled | LOCKED 2–2 | LOCKED 2–2 |
| m03 09:40 | Rød v Sjøvik SK | scheduled | CANCELLED (08:15, "Sjøvik SK withdrew before kickoff") | CANCELLED |
| m04 10:20 | Blå v Bakkely IF | scheduled | no report | LOCKED 0–2 |
| m05 10:20 | Rød v Nordbyen FK | scheduled | DRAFT 1–0 (not displayed) | LOCKED 2–0 |
| **m06 11:20** | **Blå v Kvisten IL** | **scheduled** | **ACTIVE session, first half** | **LOCKED 2–1, session ENDED** |
| m07 12:40 | Blå v Sjøvik SK | scheduled | scheduled (NEXT) | REPORTED 1–1 |
| m08 12:40 | Rød v Bakkely IF | scheduled | scheduled (NEXT) | LOCKED 1–3 |
| m09 14:00 | Rød v Nordbyen FK | scheduled | scheduled | LOCKED 4–0 |

Event: DRAFT at 08:00 and 11:30; FINALIZED at 17:10. Counts: Blå 4 matches, Rød 5; total 9 in
every fixture. Tests assert that identity fields are identical across fixtures, that recorded
facts only accumulate (a LOCKED report or a cancellation is never withdrawn later), and that the
continuity match's lifecycle is planning_open → live → done.

## The 17 mandatory integrity assertions

Implemented in `src/app/dev/ui-lab/gate-e/e02-event-day/__tests__/fixture-integrity.test.ts`. Each
runs against all three fixtures, with expected values computed from the raw records in the test
(not read back from the projection):

| # | Assertion | How it is checked |
|---|---|---|
| 1 | every match belongs to the parent Event | `m.eventId === event.id` |
| 2 | every `eventSquadId` resolves to a participating squad | squad id set membership; every squad has ≥1 match; ≥2 squads |
| 3 | unique match ids | set size within each fixture; across fixtures the same ids are deliberately shared and their identity fields asserted identical (XR-S01) |
| 4 | distinct squad ids | set size (squad names also distinct) |
| 5 | order follows kickoff timestamps | non-decreasing `startsAt`; ties ordered by Event squad order |
| 6 | displayed kickoff dates match records | time label and `presentation.kickoffTime` equal an independent UTC+1 computation; `kickoffDate` "SAT 13 MAR" |
| 7 | match dates consistent with Event timing | `event.startsAt ≤ m.startsAt ≤ event.endsAt`; one Oslo day |
| 8 | cancelled matches have no completed result | no report, reason present, null score/outcome, never NEXT |
| 9 | missing reports have no fabricated score | report null ⇒ score null |
| 10 | recorded results agree with displayed score/outcome | LOCKED/REPORTED score equals `{home: our, away: opp}`; outcome from sign; own team = squad name |
| 11 | live state requires canonical evidence | `isLive` ⇔ ACTIVE session; lifecycle `live` ⇔ `isLive`; past kickoff without session never live |
| 12 | next match correctly selected | NEXT = every eligible upcoming match at the earliest upcoming kickoff |
| 13 | simultaneous matches individually identifiable | distinct squad and squad+opponent within each equal-kickoff group |
| 14 | counts match underlying records | summary partition sums to total; per-squad totals reconcile |
| 15 | no nonexistent event-level item | one projected item per match record; Event/match keys limited to real columns; `location` null |
| 16 | unknown data never becomes zero | no score unless a recorded result; no clock label; opponent link stays null |
| 17 | Event finalisation and report completion stay distinct | projecting with Event status DRAFT and FINALIZED yields identical per-match lifecycle/report/kicker |

## Prohibited items confirmed absent

No meeting time, warm-up, meal break, transport, venue map, pitch number or ceremony appears in any
fixture or render. (The pre-existing ADR-0134 UI Lab golden at `/dev/ui-lab/event-day` shows
"Arrival · Meet at main entrance" and pitch numbers — those are not domain records; this wave does
not reuse that page — see `VISUAL_VS_CURRENT.md`.)
