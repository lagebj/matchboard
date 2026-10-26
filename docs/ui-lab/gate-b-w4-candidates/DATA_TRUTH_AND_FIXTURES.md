# Gate B W4 — Data Truth and Fixtures (B07)

## Fixture identity

Both scenarios follow the shared `FixtureIdentity` contract
(`src/app/dev/ui-lab/gate-a/shared/fixture-identity.ts`), `sourceClass: "SYNTHETIC_LABELED"`,
`viewerTimeZone: "Europe/Oslo"`, `locale: "en-GB"`.

| scenarioId | fixtureId | fixtureVersion | fixedDateTimeUtc |
|---|---|---|---|
| `B07-HISTORICAL-PATTERN` | `gate-b-w4-b07-historical-pattern` | 1 | `2026-10-25T11:45:00.000Z` |
| `B07-TRIVIAL-FACT` | `gate-b-w4-b07-trivial-fact` | 1 | `2026-10-26T10:00:00.000Z` |

Both `fixtureSha256` values are independently recomputed from each scenario's own
`rawRecordsForHash` in its own `fixtures.test.ts`, never copied back as the expectation (the test
fails first against a placeholder, then the real computed hash is read from the failure diff and
hardcoded — same process every prior Gate B wave has used).

## Match identities — new and unique, team/roster held stable

Per the brief's own instruction, no B01-B06 match id is reused. Team name, kit color, and the
eight recurring player names (`Noah`, `Sindre`, `Kasper`, `Tobias`, `Theodor`, `Markus`, `Oskar`,
`Vetle`) are the same ones `gate-b/shared/match-b-fixture.ts` has used since B01 — ADR-0157's
"one real team persisting across the programme" stable-identity requirement, the same reasoning
that file's own header comment gives for B01-B06.

- `match-gate-b07-prior-1` (20 Sep 2026, vs Fjellhug IF, WON 2-1) — debrief only, no page renders
  this match directly; cited as a `SourceRecord`.
- `match-gate-b07-prior-2` (8 Oct 2026, vs Åssiden FK, DREW 2-2) — same, cited only.
- `match-gate-b07-historical-pattern` (25 Oct 2026, vs Bærum SK, WON 3-2) — B07-A's rendered
  match. Reference/debrief time 11:45 UTC, after the final whistle, never kickoff (same B3-R4
  rule every prior Gate B wave has followed).
- `match-gate-b07-trivial-fact` (26 Oct 2026, vs Spikkestad IL, WON 4-1) — B07-B's rendered match,
  a standalone fixture with no chronological relationship to the B07-A matches (deliberately —
  the brief requires unrelated scenarios never be presented as states of the same match).

## Chronology validity

Prior matches (20 Sep, 8 Oct) both occur before the current match (25 Oct) they're cited from —
asserted directly in `historical-pattern/__tests__/fixtures.test.ts`. All matches are within
ADR-0152's 42-day/8-match `recentTeamPatterns` window of each other.

## Evidence-source categories (B07-A primary insight)

`evidenceSources: ["Match data", "Coach observation"]` — two materially distinct categories,
reusing production's own `EvidenceSourceLabel` type verbatim rather than inventing a vocabulary.
Six `SourceRecord`s back the insight: three canonical-event records (one per match, timed
goal-against) and three debrief-note records (one per match) — three distinct match `scope`
strings, never one match's event or note counted twice (asserted directly in tests).

## What is deliberately NOT built

- No full `MatchDetailAfterData`/full `AfterMatchOverview` composition — B07 reuses the same
  lighter, direct-component-composition pattern B04 established (`MatchIdentityCard`,
  `MatchTimelineList`, `MetricStrip`, `MatchFlowPanel`), not the full production page shell. B07
  is specifically about the Overview/Advisor interpretation contrast, not a second full Match
  Details reproduction.
- No `WhatThisMatchAddedPanel` — that panel's own domain (first-time positions, new observations)
  is orthogonal to B07's point and would pad the view without adding to the actual contrast being
  demonstrated.
- No Event-origin equivalent — confirmed during investigation that Event has no completed-match
  Overview/Advisor composition at all (`post_match_review`'s plan/opponent-history/
  recent-team-patterns sections are League-only, issue #696). B07 is League-only by real
  production constraint, not by choice.
