# Gate E W1 — Scenario Register

| Candidate ID | Official row | State | Route | Viewports/themes captured | Interactions | Acceptance criteria |
|---|---|---|---|---|---|---|
| `GATE-E-W1-E01-MID-SEASON` | E01 | Mid-season, current round | `/dev/ui-lab/gate-e/e01-league-temporal-orientation/mid-season-current-round` | desktop (1440×900) + mobile (390×844) + narrow (320×720), dark + light — register minimum is desktop dark + mobile light, both included | Season-select (period switching, keyboard-operable), round-select (rail click and keyboard), earlier-rounds disclosure toggle, direct URL round-restore, browser Back context restoration | Current round (Round 9) is labelled "Current round" and is never confused with past Final/Needs-closure rounds or future Upcoming/Not-generated rounds; attention (BLOCKED signal) is visible without replacing the Current-round identity; switching league season re-resolves each period's own current/needs-closure round honestly (default-focus re-resolution, not per-period round memory — see `INTERACTION_AND_STATE_AUDIT.md`); a directly-loaded URL or browser Back restores the real selected-context (XR-T01); cancelled match renders as Cancelled with its real reason, never as a result |
| `GATE-E-W1-E01-SEASON-CLOSED` | E01 | Season closed, no current round | `/dev/ui-lab/gate-e/e01-league-temporal-orientation/season-closed-no-current-round` | desktop + mobile + narrow, dark + light | None (single period, no season selector) | No round is ever labelled "Current round" when every round is in the past (XR-T01 reject case); the real fallback (most recent round still needing closure) is shown honestly instead |

## Interaction states captured by Playwright (not by the screenshot pipeline)

`e2e/ui-lab-gate-e.spec.ts` exercises, against the real local dev server:

- Current-round identification and past/future distinction (mid-season).
- Cancelled-match rendering with its real reason.
- Current-round attention visibility without losing its identity.
- Earlier-rounds disclosure collapse/reveal.
- Period switching (Spring → Autumn → Spring) and its default-focus re-resolution per period; the
  `round` URL param is confirmed cleared (not carried over) on every period switch.
- Selected-context restoration (XR-T01): a directly-loaded URL with a `round` param restores that
  round with no click; browser Back after selecting a round restores the prior selection.
- Round selection via the season rail (URL `round` param updates, focused round changes), including
  real keyboard operation (`ArrowRight` + `Enter` on the rail, `ArrowDown` on the season `<select>`).
- Navigation continuity: "Review season" and "League teams" preserve context and reach the real
  (albeit unauthenticated, in this dev-only context) auth boundary; a focused-round match row's
  real, ARR-0035-documented bare-path href does the same.
- No current-round fabrication in the season-closed state; no season selector when only one
  period exists.
- No horizontal overflow at 390px width, both states; desktop (1440px) product-surface width is
  production-equivalent, not an artificially narrow column (E01-R2).

## Screenshot capture registration

`scripts/ui-lab-visual-review.mjs` registers both routes (`gate-e-w1-e01-mid-season-current-round`,
`gate-e-w1-e01-season-closed-no-current-round`), each capturing the default
desktop/mobile/narrow × dark/light = 6 combinations (consistent with every Gate D W1/W2 entry;
register-minimum viewport/theme pairs are a subset of this default set, not a restriction on it).
