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
end-to-end in this wave. Precisely (E02-R6): verified = context preservation inside the directional E02 candidate (identity across selection, URL state, browser history); not verified = the production journey through an Event Match Detail page and Live Reporting back to the selected Event context, which cannot exist until this gap is closed. XR-V02 is directionally demonstrated only.

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
Visual-Authority-gated shared-component change. Filed as issue #852. The independent review (M3)
confirmed it and left it as an **owner decision**: fix the shared row first, or approve the E02
goldens with this defect scoped out. Since review remediation, each row carries a UI-Lab-only
"Squad v Opponent" line below 600px, so full squad and opponent names stay readable on mobile
(review M2) — but the shared row's own time/label overlap and truncation are unchanged. Related
shared-grammar quirk: the row prints "FT" on report-missing/draft rows
(`TEMPORAL_AND_LIFECYCLE_AUDIT.md`, review m2).

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
for the current head is 46071828625 (Gate E Playwright 50 passed, 36 E02 captures) — see
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

## Review round 2 (E02-R1 – E02-R6) — shared Match Presentation defects: authorization determination

### Decision: NOT authorized → `BLOCKED_BY_SOURCE_OR_AUTHORITY` for E02-R1/R2/R3

Before writing any shared-component code, the authority sources were read:

- Bundle-root `02_AUTHORITY_SCOPE_AND_APPROVALS.md`: the only authorised work is a UI-Lab-only
  design PR; "Forbidden without separate explicit permission: … production `src/components/**`
  changes …". "If the existing shared component is unsuitable … Use a dev-only candidate when
  truthful typed props suffice. Otherwise mark `BLOCKED` with source file and reason. Escalate
  architectural design conflicts before changing production code."
- `24_CONFLICT_AND_BLOCKER_REGISTER.md`: "A blocker requires a documented domain/presentation change
  decision or a revised candidate, not an undocumented workaround."
- `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` / `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`: an outcome of
  `BLOCKED — needs explicitly authorized presentation/domain change` is the defined path.
- ADR-0159: defines the review gate a shared Touchline/match-detail change must pass, and states an
  approved golden is "design reference only; NOT production implementation authorization". It does
  not grant an implementing agent permission to change shared components.
- Repo rule (AGENTS.md): at most one open PR at a time — a second Track B PR would also need the
  owner to sequence it.

No source grants that permission, so **no shared-component code was written and no Track B PR was
opened.** Issues #851 and #852 stay open; E02-R3 is filed as #853. This PR does not claim R1/R2/R3 resolved.

### Exact decision needed from the owner

| Finding | Severity | File(s) | Defect | What approval would unblock |
|---|---|---|---|---|
| E02-R1 (= BLK-E02-08, #852) | MAJOR | `src/components/touchline/scorebook/scorebook-match-row.tsx` | Scheduled kickoff time uses the score style/lane (`tl-score-list`, `w-[2.75rem]`) sized for 1–2 digit scores; it overflows into and overlaps the `Scheduled` trailer at every width | Permission for a separate PR that changes only the scheduled-phase value lane/typography (keeping home-above-away, result alignment, neutral colours, own-team marker, compact rows), with bounding-box tests and a fresh capture run over Today, League, Events, Match Details, completed history, B08 and Gate E W1/W2 |
| E02-R2 (#852) | MAJOR | same | Shared row ellipsizes squad/opponent names below 600px; the E02 UI-Lab identity line is a mitigation, not a fix | Same PR as R1: a narrow-width name-priority rule in the shared row |
| E02-R3 (#853) | MAJOR | `src/lib/matches/match-presentation.ts` (`matchPresentationPhase()`), `scorebook-match-row.tsx` | `played` and `report_incomplete` map to the `final` phase, so the row prints unqualified "FT" when only kickoff has passed or only a draft exists | A presentation-contract decision: how `played` ("kickoff passed, no report"), `report_incomplete` (draft), "live session ended", REPORTED and LOCKED should read in the shared row. `MatchLifecycleStatus` already distinguishes `played`/`report_incomplete`/`done` (`deriveMatchLifecycleStatus()`, ADR-0101/ADR-0125); the minimal change would qualify or replace "FT" for the first two phases without a second lifecycle engine. It affects ~10 consumers (Today timeline, League history rounds, Match identity card, operational card, live strip, score header, recent-football widget, Event-day timeline), so it needs explicit owner sign-off |

Owner options: (A) authorize a separate shared-component PR for R1–R3 (to be reviewed through its
own Visual Authority process before E02 goldens are approved), or (B) approve the E02 candidates
with R1–R3 explicitly excluded as known shared defects tracked in #852 (R1/R2) and #853 (R3). Only the owner can
choose (B).

### Track A (this PR) items

- **E02-R4** (MINOR) — identity line outside the row's link. **Fixed** in
  `event-day-timeline-section.tsx` (one UI-Lab link per match item; shared row unchanged).
- **E02-R5** (MINOR) — PR description described fixture-v1 numbers. **Fixed** (PR body rewritten
  from the v2 fixtures).
- **E02-R6** (documentation) — XR-V02 overstated. **Fixed**: verified/not-verified stated
  explicitly in the identity contract, VISUAL_VS_CURRENT, this file, REVIEW_RECORD and the PR body.
