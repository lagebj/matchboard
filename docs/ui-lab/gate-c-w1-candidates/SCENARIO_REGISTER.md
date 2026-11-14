# Gate C W1 — Scenario Register

Provisional register for this wave (see `SOURCE_RECONCILIATION.md` for why no official Gate C
wave-ordering document exists to draw this from). Three register rows (C01-C03), eight rendered
scenarios.

| Scenario ID | Register row | Route | Viewports captured | Themes | Interaction states | Production components mounted |
|---|---|---|---|---|---|---|
| `GATE-C-W1-C01` | C01 — Quiet day | `/dev/ui-lab/gate-c/c01-quiet-day` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayQuietState`, `TodayContextRail` |
| `GATE-C-W1-C02` | C02 — Decision day | `/dev/ui-lab/gate-c/c02-decision-day` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayNextAction`, `TodayDecisionWhy`, `TodaySelectionDecisions`, `TodayPlanningAttention`, `TodayOtherAttention` |
| `GATE-C-W1-C03-LEAGUE-PREPARE` | C03 — League, Prepare | `/dev/ui-lab/gate-c/c03-matchday-prelive/league/prepare` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayMatchday` |
| `GATE-C-W1-C03-LEAGUE-VERIFY` | C03 — League, Verify | `/dev/ui-lab/gate-c/c03-matchday-prelive/league/verify` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayMatchday` |
| `GATE-C-W1-C03-LEAGUE-IMMINENT` | C03 — League, Imminent | `/dev/ui-lab/gate-c/c03-matchday-prelive/league/imminent` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayMatchday` |
| `GATE-C-W1-C03-EVENT-PREPARE` | C03 — Event, Prepare | `/dev/ui-lab/gate-c/c03-matchday-prelive/event/prepare` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayMatchday` |
| `GATE-C-W1-C03-EVENT-VERIFY` | C03 — Event, Verify | `/dev/ui-lab/gate-c/c03-matchday-prelive/event/verify` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayMatchday` |
| `GATE-C-W1-C03-EVENT-IMMINENT` | C03 — Event, Imminent | `/dev/ui-lab/gate-c/c03-matchday-prelive/event/imminent` | desktop, mobile, narrow, 360, 430 | dark, light | initial only | `TodaySurface`, `TodayMatchday` |

Register-required viewport/theme combinations (CSV `required_viewports_or_themes`) are a
**subset** of what every scenario actually gets captured at — every Gate C scenario captures
desktop + mobile + narrow + two smoke widths, in both dark and light, exceeding each row's own
minimum rather than only hitting it.

Live Now/Matchday exclusivity is **not** a separate golden candidate in this wave (per the
brief's own §3 instruction) — it is covered as interaction/regression coverage only, both as a
component test
(`src/app/dev/ui-lab/gate-c/c03-matchday-prelive/shared/__tests__/live-now-matchday-exclusivity.test.tsx`)
and already as a production regression test
(`today-surface.matchday-livenow-gate.test.tsx`).

C07, C04-C06, and C08 have no row here — see `BLOCKERS.md` for why.
