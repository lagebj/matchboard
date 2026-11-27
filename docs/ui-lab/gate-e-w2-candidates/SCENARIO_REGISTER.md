# Gate E W2 — Scenario Register (E02)

All three candidates are children of the single official register row **E02** (Events / Event
day, "Upcoming+completed", desktop dark + mobile dark, XR-T01 XR-S01 XR-V02). Status: `CANDIDATE`.

| Candidate ID | Official row | State | Route | Reference instant (Europe/Oslo) | Captures | Interactions verified (Playwright) |
|---|---|---|---|---|---|---|
| `GATE-E-W2-E02-UPCOMING` | E02 | Upcoming — Event day before kickoff | `/dev/ui-lab/gate-e/e02-event-day/upcoming` | Sat 13 Mar 2027 08:15 | desktop 1440×900, mobile 390×844, narrow 320×720 × dark + light (register minimum desktop dark + mobile dark included) | kickoff order, one NEXT, no results, no overflow |
| `GATE-E-W2-E02-MIXED` | E02 | Mixed progression — mid-day | `/dev/ui-lab/gate-e/e02-event-day/mixed-progression` | Sat 13 Mar 2027 11:30 | same 6 + `match-selected` interaction state at all 6 (selected Rød 10:20 DRAFT match) | state kickers, squad identity, selection, same-opponent distinctness, direct-URL restore, browser Back, Back-to-event-day focus return, foreign-id rejection, tab switch, keyboard Enter, link inventory, live link to auth boundary, no Server Action, overflow, mobile dark |
| `GATE-E-W2-E02-COMPLETED` | E02 | Completed — evening, Event FINALIZED | `/dev/ui-lab/gate-e/e02-event-day/completed` | Sat 13 Mar 2027 18:00 | same 6 | results, finalised banner vs REPORTED-not-locked match, no NEXT/LIVE, overflow |

Capture matrix mirrors Gate E W1's registered default (3 viewports × 2 themes per scenario,
`scripts/ui-lab-visual-review.mjs`). Expected capture count: 3 × 6 initial + 6 `match-selected` = 24.

## Per-candidate acceptance

- **UPCOMING** — six scheduled matches across two squads in kickoff order; exactly one NEXT
  (09:00 Blå vs Nordbyen FK); every other match LATER; no score, no "FT", no live marker; the two
  12:40 matches are both shown at 12:40, Blå first by Event squad order.
- **MIXED** — two LOCKED results (09:00 ×2), one CANCELLED with its reason (09:40), one REPORT
  MISSING (10:20 Blå), one REPORT DRAFT whose draft score is not shown as a result (10:20 Rød), one
  LIVE from an ACTIVE session with no invented clock or score (11:20), two NEXT (12:40 Blå and Rød),
  one LATER (14:00 Rød vs Nordbyen FK — the same squad and opponent as the 10:20 draft match, a
  distinct match). Summary line: "9 matches in kickoff order · 2 results · 1 live · 2 need report
  follow-up · 3 to come · 1 cancelled".
- **COMPLETED** — six recorded results; Event status "Finalised" with the finalised banner; the
  12:40 Blå match is REPORTED (result shown, "Result reported · report not locked"); no NEXT, no
  LIVE, no report kicker.
