# B06 — Interaction and state audit

## Third remediation pass — no interaction-model change

R8-3 (Event · After's combination-evidence provenance) changes no interactive behavior — the
fixture's displayed evidence is now computed via the real derivation function instead of
hand-written, but every reachable control remains exactly as audited below. See
`SOURCE_RECONCILIATION.md`'s own "third remediation pass" section.

## Second remediation pass — no interaction-model change

B5/R2 and B5/R6 (Event · After's own fixture data) and B5/R7 (capture-coverage registration)
change no interactive behavior on any B06 page — Event · After's reachable controls remain
exactly as audited below (every mutation resolves to an honest, logged `notWired()` failure; the
only real control is `reopen`'s own click, still non-functional by design). See
`SOURCE_RECONCILIATION.md`'s own "second remediation pass" section for what did change (fixture
data only).

## Retrospective remediation — real origin-aware navigation added (B3-R5)

`CompareNav` (below) is reviewer navigation between the four comparison candidates — it was
never meant to demonstrate how a coach actually reaches or leaves a match. Two new real,
fixture-backed pages now do that separately: `league/match-details` (League's own real
origin/return point) and `event/event-detail` (the same for Event). Every Before/After page
links to its own origin's page via a real `next/link` in its header, and League · After/Event ·
After also link to it from their own return-destination disclosure — not only from `CompareNav`.
See `CURRENT_STATE_AUDIT.md`'s six-stage matrix for what each origin's real return destination
actually is in production.

## The comparison-nav interaction (all four pages)

`shared/compare-nav.tsx` renders four real `next/link`s (League Before/After, Event
Before/After), with `aria-current="page"` on the active stop — real, inspectable navigation
between every lifecycle-equivalent stage this wave compares, not a browser Back button and not
an inert control. This is the concrete realization of the register's "context/back continuity"
requirement (XR-S01 XR-V02).

## Default content per page — no tabs, no lifecycle-dependent default to get wrong

Unlike B05 (which has a real tab-default regression to demonstrate), none of B06's four pages
has an internal tab set — League · Before/After and Event · Before/After are each a single
scrollable composition. There is no "default tab" state machine here to audit.

## Primary-action disclosures are informational, never a fake button

"Start live reporting" (both Before pages) and "Continue report" (League · After, a real link to
the B05 candidate) are the only "primary action" affordances. League · Before and Event ·
Before's "Start live reporting" notes are rendered as plain text inside a bordered note box, not
as a `<button>` or styled to look clickable — Live Reporting is identical shared production code
for both origins and reproducing it would duplicate, not compare, so it is disclosed rather than
faked. Each page's test asserts no button with that name exists.

## Read-only vs. editable — genuinely enforced, not just visually implied

- League · Before, Event · Before: all pitches rendered `readOnly` (`TouchlinePlanningPitch`).
- League · After: no mutation entry point at all, matching the real AFTER Overview's own
  contract ("after-match-overview.tsx:36-37" — every action routes to `/post-match`).
- Event · After: `PostMatchReportShell` receives `report.status === "LOCKED"`, which hides
  add/remove/complete controls in the real component itself (not a prop this fixture invents) —
  the only reachable control, "Reopen report," is wired to an honest failure (see
  DATA_TRUTH_AND_FIXTURES.md). `PostMatchDebrief` gets `readOnly` explicitly;
  `FootballObservationSection` gets `isLocked` explicitly.

## Keyboard / focus / accessibility

- `CompareNav`'s links are real anchors (`next/link`), keyboard-reachable and activatable by
  Enter without any custom key handling.
- `DecisionBanner` renders an icon + text (never colour-only), per its own established contract.
- No custom modal/dialog/focus-trap exists anywhere in this wave's four pages — no interactive
  surface requires one (contrast with B01's "Edit lineup" local editor, which does).

## Context-local vs. non-actionable states

- The "Design proposal, not a production route" banner (Event · Before) and the "Return
  destination is Event-scoped, not match-scoped" banner (Event · After) are both
  `variant="note"` — informational context, never an unresolved-issue signal (per
  `DecisionBanner`'s own documented contract: `note` = "informational context, never an
  unresolved-issue signal").
- No accidental production mutation is possible anywhere in this wave: every action either
  navigates to a real existing route (`next/link`), is plain disclosure text, or is wired to a
  fixture-local function that resolves to an honest, logged failure.
