# Gate C W1 — Interaction and State Audit

Per the brief's §7 and §11. All interaction coverage below mounts the real production
`TodaySurface`/`TodayMatchday` components — nothing is a static screenshot only.

## Quiet day (C01)

- Component test (`c01-quiet-day/__tests__/page.test.tsx`): the next football object's real
  `<Link>` navigation target is asserted (`href`); the bounded "This week" chronology shows both
  real upcoming matches; at most one carry-forward item renders; no empty decision section
  (`Why?`, "Selection decisions") renders; `InstallPwaCard` never renders.
- Browser test (`e2e/ui-lab-gate-c.spec.ts`): the upcoming-match row's real href is asserted
  directly rather than followed through sign-in (the target is a real, auth-gated production
  route and `/dev/ui-lab` is deliberately unauthenticated — see that spec file's own comment).

## Decision day (C02)

- Component test: the primary action and its real Why? disclosure render (not the quiet hero);
  the two genuine secondary items the real cap allows are visible; the third genuine secondary
  candidate is confirmed absent — the real 2-item cap, not a hand-picked two-item fixture.
- Browser test: same assertions, end-to-end in a real browser; confirms a decision already
  represented by the primary action is not duplicated elsewhere (the primary signal's own
  round is excluded from Planning attention by construction, and the test would fail if that
  exclusion broke).
- Fixture-local adapter: `applyRecommendation` always resolves `{ success: false, message:
  "UI Lab candidate — no production mutation available." }` — a denied recommendation can never
  mutate state from this candidate, per the brief's §12/§7 constraints. No stale/denied
  recommendation scenario needed a separate candidate because C02 has no `directlyActionable`
  recommendation to apply in the first place (`recommendation: null`).

## Matchday pre-live (C03 — six scenarios)

- Component tests (one per scenario): the real featured match and its genuine phase-derived
  primary action render; PREPARE never offers Live Reporting; VERIFY never offers Live
  Reporting while a selected player is doubtful; IMMINENT offers it through the real href once
  everything is ready; League and Event hrefs stay within their own real route families.
- Browser tests: readiness links are asserted to lead to the correct match/event (League vs
  Event hrefs never cross); the phase/source nav (`MatchdayNav`) can move between all six
  combinations as real client-side navigation; no horizontal overflow at 320/360/390/430/768/
  1440px for any of the eight Gate C routes.
- Live entry is never exposed before `IMMINENT` + `canEnterLiveReporting` — proven by the
  PREPARE/VERIFY tests' explicit absence assertion.

## Live Now / Matchday exclusivity (not a separate golden candidate, per brief §3)

- `c03-matchday-prelive/shared/__tests__/live-now-matchday-exclusivity.test.tsx` proves, against
  this wave's own fixture builder, that Matchday renders when nothing is live and Live Now
  renders instead (never both) once the same match is actually live — mirroring the production
  regression test (`today-surface.matchday-livenow-gate.test.tsx`) without duplicating it.

## Scenario isolation

No fixture in this wave depends on another scenario's browser storage — see
`DATA_TRUTH_AND_FIXTURES.md`'s own "Scenario isolation" section for why the one localStorage key
Today's production code can touch (`TodaySelectionDecisions`'s dismissal state) poses no real
risk here.

## No production mutation is possible

Every `applyRecommendation` call in this wave resolves to a deterministic denial; no fixture
reaches a real server action, and no production Today file is imported for its side effects —
only its exported, pure presentation and composition functions.
