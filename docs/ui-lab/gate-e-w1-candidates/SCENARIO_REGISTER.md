# Gate E W1 — Scenario Register

| Candidate ID | Official row | State | Route | Viewports/themes captured | Interactions | Acceptance criteria |
|---|---|---|---|---|---|---|
| `GATE-E-W1-E01-MID-SEASON` | E01 | Mid-season, current round | `/dev/ui-lab/gate-e/e01-league-temporal-orientation/mid-season-current-round` | desktop (1440×900) + mobile (390×844) + narrow (320×720), dark + light — register minimum is desktop dark + mobile light, both included | Season-select (period switching), round-select (rail click), earlier-rounds disclosure toggle | Current round (Round 9) is labelled "Current round" and is never confused with past Final/Needs-closure rounds or future Upcoming/Not-generated rounds; attention (BLOCKED signal) is visible without replacing the Current-round identity; switching league season re-resolves focus to the new period's own current/needs-closure round; switching back restores Spring's current-round identity (context restoration, not caching); cancelled match renders as Cancelled with its real reason, never as a result |
| `GATE-E-W1-E01-SEASON-CLOSED` | E01 | Season closed, no current round | `/dev/ui-lab/gate-e/e01-league-temporal-orientation/season-closed-no-current-round` | desktop + mobile + narrow, dark + light | None (single period, no season selector) | No round is ever labelled "Current round" when every round is in the past (XR-T01 reject case); the real fallback (most recent round still needing closure) is shown honestly instead |

## Interaction states captured by Playwright (not by the screenshot pipeline)

`e2e/ui-lab-gate-e.spec.ts` exercises, against the real local dev server:

- Current-round identification and past/future distinction (mid-season).
- Cancelled-match rendering with its real reason.
- Current-round attention visibility without losing its identity.
- Earlier-rounds disclosure collapse/reveal.
- Period switching (Spring → Autumn) and its URL/focus re-resolution.
- Context restoration (Autumn → Spring) — current-round identity reappears, proving
  per-period re-resolution rather than stale caching.
- Round selection via the season rail (URL `round` param updates, focused round changes).
- Navigation continuity: "Review season" and "League teams" preserve context and reach the real
  (albeit unauthenticated, in this dev-only context) auth boundary; a focused-round match row's
  real, ARR-0035-documented bare-path href does the same.
- No current-round fabrication in the season-closed state; no season selector when only one
  period exists.
- No horizontal overflow at 390px width, both states.

## Screenshot capture registration

`scripts/ui-lab-visual-review.mjs` registers both routes (`gate-e-w1-e01-mid-season-current-round`,
`gate-e-w1-e01-season-closed-no-current-round`), each capturing the default
desktop/mobile/narrow × dark/light = 6 combinations (consistent with every Gate D W1/W2 entry;
register-minimum viewport/theme pairs are a subset of this default set, not a restriction on it).
