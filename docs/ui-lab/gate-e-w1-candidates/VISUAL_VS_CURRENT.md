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
orchestration logic verbatim and injects fixture data in place of a real fetch — it does not
reimplement, approximate, or diverge from production behaviour in any way.

**Practical consequence:** this candidate's screenshots are not "what League could look like" —
they are "what League, as already shipped, looks like for these two deterministic temporal
conditions." The gap between this UI Lab candidate and the real `/o/{orgSlug}/fixtures` route is
exactly: (a) the data source (fixture vs. real fetch), and (b) the absence of the two real
mutation controls, both deliberately omitted per mission brief §11.

## Operational verification

Not yet performed against a deployed environment. This wave verifies correctness via:

- Component tests (`fixtures.test.ts`, `page.test.tsx`) calling the real production functions
  directly against the fixture data.
- `e2e/ui-lab-gate-e.spec.ts` — real Chromium navigation/interaction assertions against the local
  dev server (CI only; blocked locally in this sandbox, see `BLOCKERS.md`).
- CI's `ui-lab-visual-review.yml` capture run (pending at the time of writing this document — see
  `capture-attestation.json`, produced only after the run exists).

No claim is made here that the *real, authenticated* `/o/{orgSlug}/fixtures` route has been
re-verified in this PR — it was not touched, and ADR-0144's own merged acceptance already covers
it. This wave's verification is scoped to proving the fixture-safe mount faithfully reproduces
that same real behaviour for these two specific temporal fixtures.

## Summary table

| Claim | E01 mid-season | E01 season-closed |
|---|---|---|
| Design-accepted per register | Yes | Yes |
| Backed by real production component/view-model | Yes (100%, no directional presentation) | Yes (100%) |
| Independently CI-verified (capture + Playwright) | Pending this PR's own CI run | Pending this PR's own CI run |
| Production route itself changed | No | No |
