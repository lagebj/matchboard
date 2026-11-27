# Gate E W2 — Temporal and Lifecycle Audit (E02)

The candidate projection is `src/app/dev/ui-lab/gate-e/e02-event-day/shared/event-day-projection.ts`.
It replaces only the body of production's private `deriveEventMatchLifecycle()`/state mapping in
`src/components/events/event-day-timeline.tsx`; it feeds the real `buildMatchPresentation()`.

## Lifecycle derivation (precedence top to bottom)

| Condition (canonical fields) | Candidate lifecycle | Timeline node / kicker | Row shows | Production today |
|---|---|---|---|---|
| `status === "CANCELLED"` | `cancelled` | muted `done` node · CANCELLED | "— —", Cancelled, recorded reason | `cancelled`, but node `later` · **LATER** |
| `isLive` (ACTIVE session) | `live` | `live` node · LIVE | "— —", LIVE (no clock label — none is recorded) | never `live`; falls to `played` → **FT** |
| report `LOCKED` | `done` | `done` node · none | score, FT · Win/Draw/Loss | same |
| report `REPORTED` | `done` | `done` node · none, caption "Result reported · report not locked" | score, FT · outcome | **`report_incomplete`**, FOLLOW-UP |
| report `DRAFT` | `report_incomplete` | `current` node · REPORT DRAFT, caption "Draft report — score not final" | "— —", FT · Report draft (desktop) | `report_incomplete` with the **draft score and outcome shown** |
| no report, kickoff ≤ now | `played` | `current` node · REPORT MISSING | "— —", FT · Report missing (desktop) | `played`, FOLLOW-UP |
| no report, kickoff > now, earliest upcoming kickoff | `planning_open` | `next` node · NEXT | kickoff time + date, Scheduled | NEXT only on the first such match |
| no report, kickoff > now, later | `planning_open` | `later` node · LATER | kickoff time + date, Scheduled | same |

Sources for the report rules: ADR-0001 §2 (results come from REPORTED or LOCKED reports; "DRAFT reports
show nothing"), ADR-0003 §5 (REPORTED remains a readable completed state). `EventMatchesTab`'s
coach-facing labels ("No report", "Draft", "Reported", "Completed") are reused in the selected context.

The real `ScorebookMatchRow` hides the report-attention text below the `medium` (600px) breakpoint
(it shows only "FT"); the timeline kicker carries the state at every width, so mobile never relies on
the hidden label.

## Temporal rules

- **Ordering:** kickoff instant, then the Event's own squad order, then match id. Simultaneous
  matches therefore always appear in the same order and each shows its own time label (both
  "12:40"), so no false sequence is implied between them.
- **Timezone:** every time/date label is formatted with `MATCHBOARD_DISPLAY_TIMEZONE` (Europe/Oslo,
  ADR-0137). Production formats with the browser's local zone (`formatKickoffTime()`), which is
  correct only because production renders after a client fetch; a fixture page renders on the server
  first, so the candidate pins Oslo explicitly. The real presentation's `kickoffDate`/`kickoffTime`
  are overwritten with the Oslo values; no other presentation field is altered.
- **Reference instant:** one frozen `now` per fixture (see `DATA_TRUTH_AND_FIXTURES.md`).
- **NEXT:** only an upcoming, non-cancelled, unreported, non-live match; all matches at the earliest
  such kickoff are NEXT (MIXED: both 12:40 matches). A cancelled match is never NEXT.
- **Completion:** never inferred from the clock. A past kickoff with no report is REPORT MISSING, not
  a result; a past kickoff with no session is never LIVE.
- **Live:** requires the ACTIVE session. No elapsed time, period clock or score is estimated —
  `EventMatchWithReport` carries no live score, so the live row shows "— —". `livePrimaryAction`
  drives the selected context's entry label ("Continue live reporting").
- **Event vs match status:** Event `FINALIZED` (COMPLETED) is shown as Event status only; per-match
  lifecycle is identical whatever the Event status (integrity assertion 17). Equally, a match being
  done never marks the Event complete (MIXED stays Draft with two results).
- **Duration:** no match duration or end time is shown; none is recorded in the fixtures (XR-T01 Data).

## Divergence from production — disposition

Each difference above is a data-truth requirement of E02, implemented in UI Lab only and recorded
as a production integration gap in `BLOCKERS.md` (BLK-E02-01). None is presented as shipped
behaviour, and `EventDayTimeline` is unchanged.
