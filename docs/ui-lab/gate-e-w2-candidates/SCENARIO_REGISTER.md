# Gate E W2 — Scenario Register (E02)

All three candidates are children of the single official register row **E02** (Events / Event
day, "Upcoming+completed", desktop dark + mobile dark, XR-T01 XR-S01 XR-V02). Status: `CANDIDATE`.

All three are **the same Event day** — one Event ("Fjellsiden Vårcup", Sat 13 Mar 2027), two squads,
nine matches with fixed ids, squads, opponents and kickoffs (`shared/event-day-schedule.ts`) —
observed at three reference instants. Only recorded facts differ (reports, live session,
cancellation, Event finalisation). Continuity match: `gate-e-w2-e02-m06`, 11:20 Fjellsiden Blå vs
Kvisten IL — scheduled → live → LOCKED 2–1 (XR-S01).

| Candidate ID | Official row | State | Route | Reference instant (Europe/Oslo) | Captures | Interactions verified (Playwright) |
|---|---|---|---|---|---|---|
| `GATE-E-W2-E02-UPCOMING` | E02 | Before kickoff | `/dev/ui-lab/gate-e/e02-event-day/upcoming` | Sat 13 Mar 2027 08:00 | desktop 1440×900, mobile 390×844, narrow 320×720 × dark + light, plus `continuity-match-selected` at all 6 | kickoff order, both 09:00 NEXT, no results, continuity match = Scheduled, overflow |
| `GATE-E-W2-E02-MIXED` | E02 | Mid-day progression | `/dev/ui-lab/gate-e/e02-event-day/mixed-progression` | Sat 13 Mar 2027 11:30 | same 6 + `continuity-match-selected` at all 6 | state kickers, squad identity, selection, same-opponent distinctness, direct-URL restore, browser Back, Back-to-event-day focus return, foreign-id rejection, tab switch, keyboard Enter, link inventory, live link to auth boundary, no Server Action, overflow, mobile dark, full names at 390/320px, continuity match = Live |
| `GATE-E-W2-E02-COMPLETED` | E02 | Evening, Event FINALIZED | `/dev/ui-lab/gate-e/e02-event-day/completed` | Sat 13 Mar 2027 18:00 | same 6 + `continuity-match-selected` at all 6 | results, finalised banner vs REPORTED-not-locked match, no NEXT/LIVE, continuity match = Result recorded, overflow |

Capture matrix mirrors Gate E W1's registered default (3 viewports × 2 themes per scenario,
`scripts/ui-lab-visual-review.mjs`). Expected capture count: 3 × 6 initial + 3 × 6
`continuity-match-selected` = 36. The three `continuity-match-selected` captures at one
viewport/theme are the XR-S01 side-by-side comparison.

## Per-candidate acceptance

- **UPCOMING** — nine scheduled matches across two squads in kickoff order; NEXT = both 09:00
  matches (one per squad); everything else LATER; no score, no "FT", no live marker. The 09:40
  match is not yet cancelled (its cancellation is recorded at 08:15).
- **MIXED** — two LOCKED results (09:00 ×2), one CANCELLED with its reason (09:40), one REPORT
  MISSING (10:20 Blå), one REPORT DRAFT whose draft score is never displayed (10:20 Rød), one LIVE
  from an ACTIVE session with no invented clock or score (11:20, continuity match), two NEXT (12:40
  Blå and Rød), one LATER (14:00 Rød vs Nordbyen FK — same squad and opponent as the 10:20 draft
  match, a distinct match). Summary: "9 matches in kickoff order · 2 results · 1 live · 2 need
  report follow-up · 3 to come · 1 cancelled".
- **COMPLETED** — eight recorded results and the cancelled 09:40 match; Event "Finalised" with the
  finalised banner; 12:40 Blå vs Sjøvik SK is REPORTED (result shown, "Result reported · report
  not locked"); the 10:20 Rød match's final LOCKED 2–0 differs from its 11:30 draft 1–0; no NEXT,
  no LIVE, no report kicker.
