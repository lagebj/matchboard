# Gate B W5 — Three-Part Experience Contract (B08)

The spec's own final acceptance frame — for each of the five lifecycle states: Where am I? What is
this information? What can I do next?

## BEFORE

- **Where am I?** Preparing an upcoming match against Vollen IL, kickoff pending. The scenario
  navigator and breadcrumb both say "Before."
- **What is this information?** Match identity and readiness are Class 1 facts (stored
  kickoff/opponent/squad); the planning pitch is the coach's own planned lineup, read-only here.
- **What can I do next?** Start live reporting (real link to LIVE), or return to League matches
  (navigation origin). No post-match content exists yet to confuse this state with AFTER.

## LIVE

- **Where am I?** Inside the Live Reporting workspace for the same match — explicitly labelled
  "Reporter workspace — not Match Details, not the Report."
- **What is this information?** The real `LiveMatchClient`'s own in-progress score/clock
  (1-1 at this observation instant, the match's own third goal has not happened yet) is a live,
  still-being-recorded Class 1 fact; a visible callout distinguishes it from later post-match
  reconciliation, and the read-only follower panel makes the reporter-vs-follower distinction
  explicit.
- **What can I do next?** Record events as the reporter (fixture-local only, cannot reach real
  persistence); return to the match via the breadcrumb. (Finishing reporting does not
  auto-navigate to AFTER in this candidate — disclosed in `TRANSITION_AND_NAVIGATION_CONTRACT.md`.)

## AFTER

- **Where am I?** The match has been played (2-1, final); Match Details' AFTER composition, report
  still incomplete.
- **What is this information?** Overview is curated (bounded match-story preview, Key figures
  rollup, coaching-intent review, Assistant Coach hypothesis clearly labelled as interpretation);
  Events and Stats are their own factual, full-detail owners one tab away; the lightened
  report-status widget tells the coach *that* something needs attention without repeating facts the
  After-match tab already owns in full.
- **What can I do next?** Continue the report (real link to REPORT-DRAFT); inspect the full
  chronology or stats via their own tabs. No report-editing control is reachable from here.

## REPORT-DRAFT

- **Where am I?** The report's own separate workspace, DRAFT, Players tab (the real default).
- **What is this information?** Editable goal/assist/attendance fields, plus one real, unresolved
  integrity warning (the second half's unconfirmed timing) that is not decorative — it is the actual
  condition blocking completion.
- **What can I do next?** Resolve the timing review, then complete the report (a real fixture-local
  action that locks the report); or return to the match (AFTER), preserving context.

## REPORT-COMPLETED

- **Where am I?** The same report, now LOCKED, Summary tab (the real default).
- **What is this information?** Finalized, read-only content — identical underlying facts to the
  draft (finalization didn't silently change anything), now including the Combinations tab's
  real, independently-verified evidence.
- **What can I do next?** Return to the match's historical Overview (AFTER); reopen the report via
  the same real, explicit "Reopen report" action B05 already demonstrates — never background
  editability.

Across all five states, the one invariant that makes the sequence coherent rather than five
unrelated screens: the same match identity, the same canonical event record, and a tab/report
status that is never misrepresented — verified directly by the fixture-consistency tests
(`DATA_TRUTH_AND_FIXTURES.md`) and the lifecycle/navigation tests
(`INTERACTION_AND_STATE_AUDIT.md`).
