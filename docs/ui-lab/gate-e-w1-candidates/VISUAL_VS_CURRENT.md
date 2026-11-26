# Gate E W1 — Design Acceptance vs. Production Capability vs. Operational Verification

Per the mission brief §6, these three claims are kept separate and never blended.

## Design acceptance

Both E01 candidates implement the register's own acceptance question directly: a coach can
identify the current round among historical/upcoming rounds, switch league seasons, and have the
focused/current round correctly re-resolve per period (XR-T01, XR-S02). The season-closed state
additionally proves XR-T01's explicit reject case (no fabricated current round).

## Production capability

**100% real.** Unlike every prior Gate A directional study and several Gate D candidates (D07/D08
directional, D09 partially directional), E01 introduces **zero** new presentation component and
**zero** directional/speculative design. `buildLeagueOperatingViewModel()` and `LeagueSurface`
(plus its children `LeagueSeasonRail`, `LeagueFocusedRound`, `LeagueOperationalMatchRow`,
`LeagueRecentRounds`, `LeagueEarlierRounds`) are the real, already-shipped, unmodified production
implementation (ADR-0144, merged to `main` before this wave). The only new code is a fixture-safe
URL-state mount (`league-fixture-mount.tsx`) that reproduces `FixturesPage`'s own non-fetching
orchestration logic verbatim, including reusing the real `TouchlinePageHeader`/`TouchlineButton`
header primitives (not hand-rolled markup — an independent review initially found and this PR
corrected exactly that divergence; see `REVIEW_RECORD.md` BLK-E01-05), and injects fixture data
in place of a real fetch.

**Practical consequence:** this candidate's screenshots are not "what League could look like" —
they are "what League, as already shipped, looks like for these two deterministic temporal
conditions." The gap between this UI Lab candidate and the real `/o/{orgSlug}/fixtures` route is
exactly: (a) the data source (fixture vs. real fetch), and (b) the absence of one real mutation
control, "Generate all draft squads" (a real Server Action), deliberately omitted per mission
brief §11 — "Create match" is kept, since it is a plain navigation link, not a mutation.

## Operational verification

Not performed against a deployed environment. This wave verifies correctness via:

- Component tests (`fixtures.test.ts`, `page.test.tsx`) calling the real production functions
  directly against the fixture data — 12 node + 11 component tests, all passing.
- `e2e/ui-lab-gate-e.spec.ts` — real Chromium navigation/interaction assertions against the local
  dev server, run in CI (blocked locally in this sandbox, see `BLOCKERS.md`). 14/14 passing on CI
  run `45808071999`, after fixing a real Playwright locator-precision defect an earlier CI run
  (`45801842024`) caught (BLK-E01-04).
- CI's `ui-lab-visual-review.yml` capture run (`45808071999`) completed; all 12 screenshot hashes
  independently re-verified against the downloaded artifact — see `capture-attestation.json`.

No claim is made here that the *real, authenticated* `/o/{orgSlug}/fixtures` route has been
re-verified in this PR — it was not touched, and ADR-0144's own merged acceptance already covers
it. This wave's verification is scoped to proving the fixture-safe mount faithfully reproduces
that same real behaviour for these two specific temporal fixtures.

## Summary table

| Claim | E01 mid-season | E01 season-closed |
|---|---|---|
| Design-accepted per register | Yes | Yes |
| Backed by real production component/view-model | Yes (100%, no directional presentation) | Yes (100%) |
| Independently CI-verified (capture + Playwright) | Yes — CI run 45808071999, 6/6 captures hash-verified | Yes — CI run 45808071999, 6/6 captures hash-verified |
| Production route itself changed | No | No |
