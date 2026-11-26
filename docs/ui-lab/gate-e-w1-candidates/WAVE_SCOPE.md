# Gate E — Wave 1 Scope

## Complete Gate E scenario inventory

E01–E08 (see `SOURCE_RECONCILIATION.md` §3 for the full register table, copied verbatim). None
are already `APPROVED_GOLDEN` or otherwise "accepted" — all eight carry
`official_golden_status=NOT_READY`.

## Deterministic selection rule applied

1. Preserve register order: E01, E02, E03, E04, E05, E06, E07, E08.
2. Start with the earliest unaccepted row: **E01**.
3. Include adjacent rows sharing the same owning surface or a tightly coupled user journey: E02
   is a **different surface** (Events, not League) and a different acceptance question (event-day
   multi-match progression vs. League's period/round temporal orientation). No row shares E01's
   surface. There is no adjacent row to pull in.
4. Include the necessary empty/partial/conflicting/interaction states for the selected row(s): see
   below.
5. Stop at the first clear independent review boundary: **E01 alone** is independently reviewable
   — it exercises one real, already-wired production composition (`buildLeagueOperatingViewModel()`
   + `LeagueSurface`), with no dependency on any other Gate E row.
6. Defer every other row explicitly (table below).
7. No later row is pulled in merely because it looked easier (E05/E06 are plausibly simpler than
   E01, but E01 is still earliest in register order and is not blocked).

## Selected scenario: E01 only

**League / Fixtures and results** — "Current planning round identifiable among
historical/upcoming; period navigation + context restoration" (XR-T01, XR-S02).

### Exact acceptance criteria (from the register + XR-T01/XR-S02)

- A coach looking at League can identify which round is happening *now*, distinct from completed
  history and upcoming rounds, without inspecting every round individually.
- "Current" is a real temporal fact (kickoff falls in the current Europe/Oslo ISO week), never a
  selection-state guess, and is never fabricated when no round is actually current.
- A coach can move between league seasons (periods) and have the focused/current round
  re-resolve correctly for the newly selected period — never carrying over a stale selection from
  the previous period.
- Returning to a previously selected period/round restores the correct context.

### Reason for this exact scope (not wider, not narrower)

- E01 is a single register row with no sibling row sharing its surface — grouping it with
  anything else would violate the "don't expand the wave" rule with no coupling justification.
- It requires no new domain capability: `buildLeagueOperatingViewModel()`/`LeagueSurface` are
  real, already-shipped, pure, DB-free production code (`CURRENT_STATE_AUDIT.md`). The only gap is
  a fixture-safe seam around the self-fetching route wrapper, which is a bounded, low-risk,
  UI-Lab-only change.
- It has no dependency on any authority conflict, blocked policy decision, or undecided domain
  question (unlike Gate D's D07/D08 at their outset). See `BLOCKERS.md` — nothing here is
  `BLOCKED`.

### Expected candidate states (minimum set; full matrix in `SCENARIO_REGISTER.md`)

Two states, chosen to cover the acceptance question's two genuinely distinct temporal shapes:

1. **`mid-season-current-round`** — the season has past (FINAL and NEEDS_CLOSURE), current, and
   future (NOT_GENERATED-attention and READY-quiet) rounds simultaneously, plus a second,
   fully-completed league season, to exercise period switching and the resulting
   re-resolution of "current"/focused round (context restoration).
2. **`season-closed-no-current-round`** — every round in the only league season is in the past.
   This is XR-T01's own explicit reject case: Matchboard must never fabricate a false "current"
   round just because League is being viewed; it must honestly fall back to the most recent round
   still needing closure.

Both states reuse the exact same real production components and view-model function; only the
fixture `FixturePeriod[]` input differs.

### Existing production functionality reused

- `buildLeagueOperatingViewModel()` (`src/lib/touchline/presentation/league-view-model.ts`) —
  unmodified.
- `LeagueSurface`, `LeagueSeasonRail`, `LeagueFocusedRound`, `LeagueOperationalMatchRow`,
  `LeagueRecentRounds`, `LeagueEarlierRounds` (`src/components/fixtures/*`) — unmodified.
- The real `season`/`round` URL-query-param selection-authority pattern from `fixtures-page.tsx`,
  reproduced (not duplicated as a second business logic) in the new fixture-safe mount.

### Dependencies

None on any other Gate E row. One dependency on the existing `TeamIdentityStrip`/
`resolveKitColorSwatch()` presentation primitives (already real, already shared).

### Authority constraints

UI-Lab-only, per §2 of `SOURCE_RECONCILIATION.md`. No production route, domain service, or Prisma
schema change. No new mutation surface — "Generate all draft squads" and "Create match" are
intentionally not reproduced in the fixture mount (mission brief §11, "never invoke real Server
Actions from synthetic UI Lab controls").

## Deferred scenarios and reasons

| ID | Reason for deferral |
|---|---|
| E02 | Different surface (Events), different acceptance question (event-day multi-match/squad progression). Not adjacent to E01 by the deterministic rule. Candidate for Wave 2. |
| E03 | Season Review — different surface, substantially larger scope (story-first overview, five story families, §6 of the mission brief's surface-specific guidance). Not adjacent to E01. |
| E04 | Opponent Detail — different surface, depends on opponent-memory evidence presentation distinct from League's operational temporal model. Not adjacent to E01. |
| E05 | Team Detail — different surface (tab-specific task composition), reuses ADR-0156 Team Season Profile; a plausible future wave on its own. Not adjacent to E01. |
| E06 | Settings and rules — different surface (administrative forms), explicitly out of the "coaching operating surface" family E01–E05/E07/E08 belong to. |
| E07 | Season review, Assistant Coach seasonal themes — groups with E03 (same surface), not E01. Requires Team Season Profile time-window reuse, a distinct concern from League's temporal rail. |
| E08 | Events and League, structured squad proposal — touches Assistant Coach squad-proposal validation, a materially larger and riskier scope (new proposal review flow) than E01's read-only temporal presentation. Explicitly excluded from "new ranking/Assistant Coach capability" by mission brief §14 unless it reuses an existing capability; needs its own dedicated audit. |

No scenario ID was invented or skipped: all eight register rows (E01–E08) are accounted for above,
either selected (E01) or deferred with a stated reason.

## What this wave will NOT prove

It will not demonstrate Events, Season Review, Opponent Detail, Team Detail, Settings, Assistant
Coach seasonal themes, or structured squad proposals (E02–E08) — all deferred to later Gate E
waves. It will not touch production routes, domain services, or Prisma schema anywhere in this
wave. It will not fix ARR-0035 (bare unscoped hrefs) — that residue is disclosed, not resolved,
here (`BLOCKERS.md`).
