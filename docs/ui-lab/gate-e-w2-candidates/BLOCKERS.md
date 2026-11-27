# Gate E W2 — Blockers and Integration Gaps (E02)

No authority conflict or missing source blocks E02 (`SOURCE_RECONCILIATION.md`). The items below
are production integration gaps the candidate demonstrates around or discloses, plus environment
limitations of this session. None was fixed in production code: the authority scope forbids it in a
UI-Lab-only wave.

## Production integration gaps (not fixed here)

### BLK-E02-01 — `EventDayTimeline` lifecycle projection misstates live, draft, reported and cancelled matches

`src/components/events/event-day-timeline.tsx` never yields `live` (ignores canonical `isLive`),
passes DRAFT scores and outcomes to the presentation, treats REPORTED as follow-up (contrary to
ADR-0001/0003), labels cancelled matches LATER, has no tie-break for equal kickoffs and marks only
one NEXT. The candidate's projection shows the corrected behaviour in UI Lab only
(`TEMPORAL_AND_LIFECYCLE_AUDIT.md`). Production adoption needs a separate, authorised change to
that component (and, ideally, an exported pure projection shared by production and UI Lab so the
two cannot drift). Severity: important for E02 production conformance. Filed together with
BLK-E02-03 as issue #851.

### BLK-E02-02 — No Event Match Detail destination or per-match selection exists

`03_WORKSPACE_OWNERSHIP_AND_MATCH_LIFECYCLE.md` IA scenario 3 ("Event squad → Event Match Detail →
report") and XR-I01 ("detailed editing of an individual match belongs in its own Match Details
context") describe a destination production does not have: `matches/[eventMatchId]/` contains only
`live/` and `live/follow/`, and report/lineup/helpers are inline panels in the Matches tab with no
URL state. The candidate's `match` parameter and context panel are directional. The "Report and
lineup in Matches tab" link opens the tab but cannot target the match. A product decision is needed
(new route vs. URL-addressable panel in the Matches tab). XR-V02's full cross-route journey (Today →
Event match → Live Reporting → back to the selected Event context) therefore cannot be demonstrated
end-to-end in this wave.

### BLK-E02-03 — A failed match fetch renders as "no Event day"

`EventDayTimeline` converts a fetch failure into `[]` and returns `null`. Not required by the E02
row, so no failure candidate was added; recorded for a production fix.

### BLK-E02-04 — No fixture seam / fixed clock in the production timeline

The timeline self-fetches through a Server Action and reads `new Date()`, so it cannot be mounted
deterministically. A pure exported projection taking `now` (as this wave's UI-Lab module does) would
let UI Lab render the real production function. Not built here (spec §8: do not modify production
components merely to enable fixture injection).

### BLK-E02-05 — Separate fetches in Overview and Matches tab

`EventDayTimeline` and `EventMatchesTab` each fetch `listEventMatchesAction()`. Only one is mounted
at a time and remounting re-fetches, so no divergence was found in the normal flow; recorded, not a
second source of truth.

### BLK-E02-08 — `ScorebookMatchRow` scheduled rows: kickoff time overlaps "Scheduled"; opponent truncates on mobile

Found by inspecting this PR's real CI captures (run 46018113731), not by code reading. In the
`scheduled` phase the production row renders the kickoff time (e.g. "12:40") in the 2rem
`tl-score-list` style inside a `w-[2.75rem]` value lane sized for a score; the time overflows over
the `w-[4.5rem]` "Scheduled" trailer at every width, and at 390/320px the `shrink-0` date span
squeezes the opponent to an ellipsis ("Nordbye…"). This affects every scheduled row in UPCOMING
and the three upcoming rows in MIXED. It is in the unmodified shared Touchline component (production
Event day renders it the same way), so it is not fixed in this UI-Lab-only wave: a fix is a
Visual-Authority-gated shared-component change. Filed as issue #852. Severity for E02: MAJOR for
mobile opponent readability (spec §10 requires opponent to stay visible); the full opponent name
is still shown in the selected-match context.

### Pre-existing residue surfaced

The header "Back" link reproduces production's bare `/events` href (ARR-0035, as in W1).

## Environment limitations of this session

### BLK-E02-06 — Local browser verification not possible in this sandbox

A local `next dev` from this worktree failed to compile under Turbopack ("Could not find the Next.js
package (next/package.json)") because the worktree's `node_modules` is a symlink to the main
checkout, outside the project root; the first attempt also stopped on Next.js's one-time security
upgrade notice (W1 BLK-E01-02 saw the same notice). Independently, this devcontainer is known not to
complete Playwright hydration (HMR WebSocket). The E02 Playwright tests and captures were therefore
not run locally; the CI `ui-lab-visual-review.yml` run is the browser evidence. That run
(46018113731, attempt 1) has since completed: Gate E Playwright 42 passed, 24 E02 captures — see
`capture-attestation.json`.

### BLK-E02-07 — `tsc` with default heap runs out of memory here

`npm run typecheck` aborted with a V8 heap-out-of-memory error inside `npm run validate -- --fast`;
the same `tsc --noEmit` passes (exit 0) with `NODE_OPTIONS=--max-old-space-size=4096`. Environmental
(the sandbox's `npm run build` OOM is a known, pre-existing condition); CI's typecheck job is
authoritative.

## Not done in this session

- BLK-E02-01/03 → issue #851; BLK-E02-08 → issue #852. BLK-E02-02/04/05 are product/architecture
  decisions recorded here, not filed.
- No owner Visual Authority approval was requested, posted or assumed.
