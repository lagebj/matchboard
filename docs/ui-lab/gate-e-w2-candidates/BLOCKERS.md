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
two cannot drift). Severity: important for E02 production conformance. Suggested follow-up: a
GitHub issue for the timeline defects (not filed by this session — see "Not done" below).

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

### Pre-existing residue surfaced

The header "Back" link reproduces production's bare `/events` href (ARR-0035, as in W1).

## Environment limitations of this session

### BLK-E02-06 — Local browser verification not possible in this sandbox

A local `next dev` from this worktree failed to compile under Turbopack ("Could not find the Next.js
package (next/package.json)") because the worktree's `node_modules` is a symlink to the main
checkout, outside the project root; the first attempt also stopped on Next.js's one-time security
upgrade notice (W1 BLK-E01-02 saw the same notice). Independently, this devcontainer is known not to
complete Playwright hydration (HMR WebSocket). The E02 Playwright tests and captures were therefore
not run locally; the CI `ui-lab-visual-review.yml` run is the browser evidence. Results are recorded
in `REVIEW_RECORD.md` and `capture-attestation.json` only after that run has completed.

### BLK-E02-07 — `tsc` with default heap runs out of memory here

`npm run typecheck` aborted with a V8 heap-out-of-memory error inside `npm run validate -- --fast`;
the same `tsc --noEmit` passes (exit 0) with `NODE_OPTIONS=--max-old-space-size=4096`. Environmental
(the sandbox's `npm run build` OOM is a known, pre-existing condition); CI's typecheck job is
authoritative.

## Not done in this session

- No GitHub issue was filed for BLK-E02-01/03 — they are recorded here for the owner to triage.
- No owner Visual Authority approval was requested, posted or assumed.
