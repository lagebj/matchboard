# Gate E — Wave 2 Scope (E02)

## Selection

Applying the W1 deterministic rule (`docs/ui-lab/gate-e-w1-candidates/WAVE_SCOPE.md`) after E01
merged in PR #848: register order E01 → E08; E01 is done; the earliest unaccepted row is **E02**.
No later row shares E02's surface (Events / Event day). E08 ("Events and League / Structured squad
proposal") touches Events too, but it is a different capability (Assistant Coach squad proposals,
XR-P02) and is explicitly excluded by this wave's brief. **Wave 2 = E02 only.**

## Exact acceptance criteria (from the register row + XR-T01/XR-S01/XR-V02)

1. A coach viewing one Event with several matches in different states, across more than one
   squad, can tell what happened, what needs attention and what comes next without inspecting
   every match (XR-T01 Accept).
2. Past/current/future states are deliberately differentiated in one chronology, never equal-weight
   date-sorted cards (XR-T01 Reject), and every state is named in text.
3. Event-day order is maintained across squads and states, with no fabricated duration or schedule
   item (XR-T01 Required/Data).
4. The same match keeps one recognizable identity (squad, opponent, kickoff or result, lifecycle)
   in the timeline and in its selected context; the information priority changes with lifecycle,
   not the identity (XR-S01).
5. Moving Event → match → back restores the selected context; the Event heading never changes;
   no competing copy of a match's state and no lost selection (XR-T01 Interactions, XR-V02).
6. Required states: upcoming and completed. Required captures: desktop dark and mobile dark.

## Child candidates

| Candidate | Why it is needed |
|---|---|
| `GATE-E-W2-E02-UPCOMING` | The register's "upcoming" state: one genuine NEXT, no results anywhere. |
| `GATE-E-W2-E02-MIXED` | The primary acceptance case: one Event mid-day with result, cancelled, report-missing, report-draft, live, next and later matches across two squads. Without it "progression across squads/states" is not demonstrated. |
| `GATE-E-W2-E02-COMPLETED` | The register's "completed" state, including Event FINALIZED with one REPORTED-not-locked match (finalisation ≠ every report locked). |

These are child candidates of the single official row E02, not new register rows. A live match is
included only in MIXED, and only because the fixture carries a canonical ACTIVE live-session record
(XR-S01 names planned/live/completed identity). No loading/failure candidate is added: the register
row does not require one (the production gap is recorded as BLK-E02-03).

## Reused / new

- Reused unmodified: `buildMatchPresentation()`, `TouchlineTimeline`, `TimelineItem`,
  `ScorebookMatchRow`, `TouchlinePageHeader`, `TouchlineButton`, `TabRail`, `DecisionBanner`,
  `resolveLiveReportingPrimaryAction()`, `describeLiveReportingEntryPointLabel()`,
  `getEventPeriodConfig()`, `formatGameFormat()`, `EventMatchWithReport` (type).
- New, UI-Lab-only: a pure Event-day projection (fixture-safe stand-in for the private
  `deriveEventMatchLifecycle()` body), a fixture-safe Event Detail mount, a selected-match context
  panel (directional), a squad-progression aside (directional), three fixtures.

## Deferred

| ID | Reason |
|---|---|
| E03 | Season Review — different surface. |
| E04 | Opponent Detail — different surface. |
| E05 | Team Detail — different surface. |
| E06 | Settings/rules — administrative surface. |
| E07 | Season review Assistant Coach themes — groups with E03. |
| E08 | Structured squad proposal (Assistant Coach, XR-P02) — excluded by this wave's brief; needs its own audit. |

## What this wave does not prove

It does not change or verify production Event Detail, `EventDayTimeline` or `EventMatchesTab`; it
does not create an Event Match Detail route; it does not demonstrate a cross-route Today → Event →
Live Reporting → return journey end-to-end (the outbound links are real, but the return leg lives in
production routes this UI-Lab-only wave cannot exercise — BLK-E02-02).
