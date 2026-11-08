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
  persistence — and a genuinely recorded event now really does carry through to the Report, W5
  remediation P1-6); return to the match via the breadcrumb; or finish reporting, which really does
  navigate straight to REPORT-DRAFT (the real production `handleEndSession()`/`reportUrl()`
  behavior, confirmed working — see `TRANSITION_AND_NAVIGATION_CONTRACT.md`'s own "RESOLVED"
  section; the report workspace, not a second AFTER view, is the correct destination).

## AFTER

- **Where am I?** The match has been played — final score as ACTUALLY recorded (2-1 reference by
  default; whatever the coach's own interactive LIVE session reconciled, if one exists — the shared
  projection cascade, W5 second remediation, makes this page always agree with REPORT-DRAFT/
  REPORT-COMPLETED about the same match, never a second, different history); Match Details' AFTER
  composition — either "report still incomplete" or "report completed," depending on the real,
  persisted report status, not an unconditioned URL switch (the `?report=` param only selects the
  presentation when no persisted report exists at all — W5 remediation P1-5, tightened by the second
  remediation pass — the SAME composition represents both states, per ADR-0147, never a third
  lifecycle surface).
- **What is this information?** Overview is curated (bounded match-story preview, Key figures
  rollup, coaching-intent review, Assistant Coach hypothesis clearly labelled as interpretation);
  Events and Stats are their own factual, full-detail owners one tab away; the lightened
  report-status widget tells the coach *that* something needs attention without repeating facts the
  After-match tab already owns in full.
- **What can I do next?** When incomplete: continue the report (real link to REPORT-DRAFT). When
  completed: view the finalized report (real link to REPORT-COMPLETED). Either way: inspect the
  full chronology or stats via their own tabs. No report-editing control is reachable from here —
  every visible report link, including the reused `MatchAfterMatchPanel`'s own secondary one, now
  resolves inside the UI Lab (W5 remediation P2-8).

## REPORT-DRAFT

- **Where am I?** The report's own separate workspace, DRAFT, Players tab (the real default).
- **What is this information?** Editable goal/assist/attendance fields, plus one real, unresolved
  integrity warning (the second half's unconfirmed timing) that is not decorative — it is the actual
  condition blocking completion.
- **What can I do next?** Resolve the timing review, then complete the report (a real fixture-local
  action that locks the report, in place, no navigation); or return to the match (AFTER), preserving
  context — and once completed in place, "return to match" correctly routes to AFTER's own completed
  variant, not the stale incomplete one (W5 remediation P1-5).

## REPORT-COMPLETED

- **Where am I?** The same report, now LOCKED, Summary tab (the real default).
- **What is this information?** Finalized, read-only content — identical underlying facts to the
  draft (finalization didn't silently change anything), now including the Combinations tab's
  real, independently-verified evidence.
- **What can I do next?** Return to the match's historical Overview (AFTER); reopen the report via
  the same real, explicit "Reopen report" action B05 already demonstrates — never background
  editability.

Across all five states, the one invariant that makes the sequence coherent rather than five
unrelated screens: the same match identity, the same canonical event record — resolved through one
shared fixture-local projection (`shared/b08-projection.ts`) so AFTER, REPORT-DRAFT and
REPORT-COMPLETED can never disagree about which match actually happened — and a tab/report status
that is never misrepresented — verified directly by the fixture-consistency tests
(`DATA_TRUTH_AND_FIXTURES.md`), the shared-projection tests (`b08-projection.test.ts`), and the
lifecycle/navigation tests (`INTERACTION_AND_STATE_AUDIT.md`).
