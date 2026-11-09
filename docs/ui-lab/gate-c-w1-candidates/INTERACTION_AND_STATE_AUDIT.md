# Gate C W1 — Interaction and State Audit

Per the brief's §7/§11 and the independent review of PR #826. All interaction coverage below
mounts the real production `TodaySurface`/`TodayMatchday` components.

## Production regression coverage (new, independent review remediation)

`src/components/touchline/today/__tests__/today-surface.matchday-quiet-composition.test.tsx` —
19 tests, directly against `TodaySurface` (not through Gate C's own fixtures), proving:

- **P1-01:** no contradictory "Nothing needs your attention" hero alongside a genuine Matchday
  action; the calm hero still shows when there is genuinely no Matchday anchor.
- **P1-02:** "Today in order" shows alongside Matchday even with no situational decision; the
  featured match is never repeated as unresolved lower chronology; an unrelated genuine
  situational decision remains visible alongside Matchday; "Today in order" never shows on a
  genuinely quiet day with no Matchday anchor and no decision.
- **P1-04 (6 tests):** organisation-wide squad availability remains visible across all four
  quiet/decision × with/without-Matchday combinations — with a scope label ("All active players")
  exactly when a Matchday anchor also exists, and with deliberately different organisation-wide
  vs. match-specific numbers so neither value can mask the other; a missing canonical org-wide
  result never fabricates an empty widget; Live Now/Matchday exclusivity is unaffected by the fix.
- **P1-05 (7 tests):** zero/one/two/three carry-forward items, across quiet (with and without
  Matchday) and decision composition — every item appears exactly once, using distinct labels so
  a count-only assertion could not mask a dropped or duplicated item.

## Quiet day (C01)

- Component test: the next football object's real href is asserted; the bounded "This week"
  chronology shows both real upcoming matches; the first of three carry-forward items features
  inline exactly once, and the remaining two stay reachable rather than being dropped (P1-05);
  organisation-wide squad availability renders exactly once (P1-04); no empty decision section
  renders; `InstallPwaCard` never renders; every upcoming-match kickoff date falls within
  production's real 7-day window, independent of the real clock (P2-01).
- Browser test: the upcoming-match row's real canonical org-scoped href is asserted, the link is
  actually clicked, and the real resulting destination (`/signin`, a genuine auth redirect for
  this synthetic id) is verified (P2-02); all three carry-forward items remain reachable on both
  desktop and mobile viewports, each exactly once (P1-05).

## Decision day (C02)

- Component test: the primary action is the real Jonas identity-collision case (P2-03) — its own
  problem text appears exactly once even though the same signalKey also exists as a raw
  plan-integrity signal; a genuinely different secondary decision (Noah) remains visible; the
  real 2-item cap drops the third genuine candidate.
- Browser test: same assertions end-to-end in a real browser, plus the Round Board link's real
  canonical org-scoped href, click, and real `/signin` destination (P2-02).
- Fixture-local adapter: `applyRecommendation` always resolves `{ success: false, message:
  "UI Lab candidate — no production mutation available." }` — a denied recommendation can never
  mutate state from this candidate.

## Matchday pre-live (C03 — six scenarios)

- Component tests (one per scenario): the real featured match (now selected by the real
  `selectFeaturedTodayFootballMatch()` out of a genuinely busy day, P1-02) and its genuine
  phase-derived primary action render; PREPARE never offers Live Reporting; VERIFY never offers
  it while a selected player is doubtful; IMMINENT offers it through the real org-scoped href;
  League/Event hrefs stay within their own real route families; league/prepare and event/prepare
  additionally prove the busy-day chronology (earlier/later matches discoverable, featured match
  never repeated, League/Event distinctness) and the absence of the P1-01 contradiction.
- Browser tests: readiness links are asserted to have the correct canonical org-scoped shape,
  are actually clicked, and reach the real `/signin` auth boundary (P2-02); the phase/source nav
  can move between all six combinations as real client-side navigation; no horizontal overflow at
  320/360/390/430/768/1440px for any of the eight Gate C routes; league/prepare additionally
  proves organisation-wide availability (28 available) and Matchday's own distinct match-specific
  readiness (8 of 11 planned) both remain visible, on desktop and mobile, with a scope label
  ("All active players") disambiguating them (P1-04).

## Fixture-builder unit tests (new, P2-01)

`src/app/dev/ui-lab/gate-c/shared/__tests__/fixtures.test.ts` — proves, independently of the
developer machine's clock: every phase/source combination resolves to its intended
`TodayMatchdayPhase` via the real `resolveTodayMatchdayPhase()`; `gateCBuildBusyDay()` is fully
deterministic across repeated calls; every same-day candidate match falls on the real Europe/
Oslo calendar day (via the real `getDisplayDateKey()`); the real selector picks the intended
featured match out of a genuinely busy day, not the earlier or later one.

## Live Now / Matchday exclusivity (not a separate golden candidate, per brief §3)

`c03-matchday-prelive/shared/__tests__/live-now-matchday-exclusivity.test.tsx` proves, against
this wave's own busy-day fixture builder, that Matchday renders when nothing is live and Live
Now renders instead (never both) once the same match is actually live.

## Scenario isolation

Unchanged from the original wave — see `DATA_TRUTH_AND_FIXTURES.md`'s own section.

## No production mutation is possible

Every `applyRecommendation` call resolves to a deterministic denial; no fixture reaches a real
server action or the database.
