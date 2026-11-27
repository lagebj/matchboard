# Gate E W2 — Source Reconciliation (E02)

Status: produced before scope and implementation decisions for Gate E Wave 2, following the same
recover → audit → scope → implement order and the same method as
`docs/ui-lab/gate-e-w1-candidates/SOURCE_RECONCILIATION.md`.

## 1. Source bundle location

The handoff bundle was read on disk at
`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/` (gitignored, not
tracked — same convention as Gates A–E W1). Its two numbering schemes are the same as W1 recorded:
bundle-root `00`–`09` files and the independent `programme_v054/00`–`26` files.

| Document | Actual location | Status |
|---|---|---|
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` | `programme_v054/` | FOUND, E02 row read (line 26) |
| `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` | `programme_v054/` | FOUND, read in full |
| `02_AUTHORITY_SCOPE_AND_APPROVALS.md` | bundle root (not `programme_v054/02_…`, which is the Gate A spec) | FOUND, read in full |
| `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` | `programme_v054/` | FOUND, read in full (XR-T01/XR-S01/XR-V02 below) |
| `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` | `programme_v054/` | FOUND, read in full |
| `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` | `programme_v054/` | FOUND, read in full |
| `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md` | `programme_v054/` | FOUND, read in full |
| `24_CONFLICT_AND_BLOCKER_REGISTER.md` | `programme_v054/` | FOUND, read in full |
| `03_WORKSPACE_OWNERSHIP_AND_MATCH_LIFECYCLE.md` | `programme_v054/` | FOUND, read (Events row and IA scenarios — additionally consulted) |
| `14_EXPERIENCE_REQUIREMENT_TRACEABILITY.csv` | `programme_v054/` | FOUND, read (E02's XR mapping — additionally consulted) |

No required source was missing, so the "missing source" procedure does not apply.

## 2. The official E02 row (verbatim from the CSV)

```
E02,E,Events,Event day,Upcoming+completed,Desktop dark + mobile dark,Multi-match event-day progression across squads/states with persistent event and match identity (XR-T01 XR-S01 XR-V02),"event-detail, event-day-timeline",Needs golden,GATE_E,DIRECTIONAL_ONLY,NOT_READY,,b070df73664d816f1b0ebc61d54487a24044972e
```

| Field | Value |
|---|---|
| ID | E02 |
| Surface | Events / Event day |
| Required state | Upcoming+completed |
| Viewports/themes | Desktop dark + mobile dark |
| Primary acceptance question | Multi-match event-day progression across squads/states with persistent event and match identity (XR-T01 XR-S01 XR-V02) |
| Owners | `event-detail`, `event-day-timeline` |
| Status | Needs golden · `DIRECTIONAL_ONLY` · `NOT_READY` |

## 3. Normative wording of the cited requirements

Quoted from `programme_v054/13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`.

### XR-T01 — Temporal orientation across the football product (applies to "Events E02")

- **Required:** "Render past/current/future periods as recognizable, deliberately differentiated
  states in the same chronology. Show the active date, round, or event context and distinguish the
  next action from completed history. Event-day view maintains match order across multiple squads
  and match states."
- **Data:** "Date, kickoff and lifecycle are canonical; match duration is unknown unless
  configured/recorded. Do not lay out fictitious continuous match blocks or interpolate unrecorded
  action."
- **Interactions:** "Moving period → round/event → match → back restores the selected context and
  appropriate anchor whenever navigation permits."
- **Accept:** "A coach viewing multiple matches at different states can identify what comes next
  and which action is relevant, without manually inspecting every date card."
- **Reject:** "Merely date-sorted equal-weight cards; loss of active round/date on return;
  fabricated duration or false chronology."

### XR-S01 — Stable first-class match identity (applies to "E01/E02")

- **Required:** "Reuse one recognizable visual identity for the same match in planned, live and
  completed contexts: participating teams, source-aware competition/round, kickoff or result,
  canonical lifecycle status and current action where relevant. The information priority changes
  by lifecycle, not the underlying identity."
- **Data:** "Configure team/kit colors from canonical source. Unknown opponent identity uses neutral
  treatment. No fabricated crests, photos, score statistics."
- **Accept:** "Side-by-side planned/live/completed versions of one fixture remain recognizably the
  same object on desktop/mobile, dark/light, while clear emphasis moves from kickoff/plan → active
  reporting → result/review."
- **Reject:** "Entirely unrelated header templates across lifecycle; decorative kit or score
  invention; identical hierarchy across all states."

### XR-V02 — Evidence of route-level coherence (applies to "E01/E02")

- **Required:** "Validate one cross-route scenario where context is preserved across an operational
  journey, including mobile. The same match state, source, and identity appear consistently at
  Today, League/Event, Match Details, and reporting when relevant."
- **Accept:** "User can follow Today → match → relevant action → prior context; no competing copies
  of the same state or lost selection."
- **XR-I01/XR-I02 refinement:** "Avoid navigation entirely for ordinary object edits.
  Origin-aware return rules also apply where deliberate separate workspaces (Live Reporting /
  Post-Match Reporting) remain justified. Every CTA must have a classified host and navigation
  rationale."
- **Reject:** "Individually appealing screens that break the workflow or contradict canonical match
  identity."

## 4. Supporting requirements consulted

- `03_WORKSPACE_OWNERSHIP_AND_MATCH_LIFECYCLE.md`: Events owns "event identity/readiness, squads,
  event-day chronology and match links"; "Event identity, participating squads and a multi-match
  event-day sequence remain central. Event matches retain canonical match identity rather than
  appearing as generic fixtures." Canonical labels: "Planning open, Planning closed, Live, Played,
  Report incomplete, Done, Cancelled. Report draft/completed refers to report-specific lifecycle,
  not a second match status." IA scenario 3: "Event squad → Event Match Detail → report, without
  accidental League-only assumptions."
- `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` (XR-I01): "Events: Standard event-level squad
  decisions remain in Event context; detailed editing of an individual match belongs in its own
  Match Details context when the user deliberately opens that match." Default decision `SAME_VIEW`;
  optional `CONTEXT_INSPECTOR`; "Browser Back must not strand the coach in an unexpected context."
- `21_FIXTURE_CAPTURE_AND_AUTHORITY.md`: frozen clock, explicit timezone/locale, no `Date.now()`,
  stable ids; "label displayed `unknown`, `not recorded`, `not applicable`, and `0` distinctly";
  evidence levels (`CANDIDATE_GOLDEN` needs human approval).
- `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` D5: "Distinguish zero, unknown, not recorded, not
  applicable, and incomplete coverage." D1: "Exposing a fact or contextual link in several places is
  permitted; implementing competing calculations or mutation paths is not."
- `14_EXPERIENCE_REQUIREMENT_TRACEABILITY.csv` maps E02 to XR-T01, **XR-T02**, XR-S01, XR-V01 and
  XR-V02. The register row cites only XR-T01/XR-S01/XR-V02, so the register row governs this
  wave's acceptance. XR-T02 (match event-chronology density) concerns a match's own event log,
  which an Event-day list does not render; XR-V01 is satisfied by `VISUAL_VS_CURRENT.md`'s
  current-state comparison. Neither is turned into a new acceptance criterion here.
- `24_CONFLICT_AND_BLOCKER_REGISTER.md`: BLK-04 ("Existing fixture Date.now kickoff …") is the
  reason every E02 fixture uses a frozen reference instant; no other listed blocker applies to E02.

## 5. Authority scope (bundle-root `02_AUTHORITY_SCOPE_AND_APPROVALS.md`)

Only a UI-Lab-only design PR is authorised: `src/app/dev/ui-lab/**`, nonproduction tests, narrow
capture-script changes, candidate documentation. Forbidden without separate permission: production
`src/app/(app)/**`, production `src/components/**`, `src/domain/**`, Prisma schema, auth/permissions,
app shell/global CSS, deployment workflows. `DESIGN_DIRECTION_ACCEPTED` ≠ `CANDIDATE_GOLDEN` ≠
`APPROVED_GOLDEN` ≠ `VERIFIED_PRODUCTION`; a green capture pipeline is not approval.

This wave stays inside that boundary. Its only non-`src/app/dev/ui-lab/**` changes are the shared
Gate E Playwright spec, the capture script's scenario registration, the existing UI Lab capture
workflow's job timeout (75 min, same pattern as W1's bump), and the version bump.

## 6. Repository authorities consulted

- ADR-0125 (`0125-reference-convergence-match-presentation-timeline-evidence-story.md`) —
  `buildMatchPresentation()` is the one match projection; reused unmodified.
- ADR-0134 (`0134-visual-identity-frontend-reset-touchline.md`) and ADR-0136
  (`0136-touchline-design-atlas-composition-convergence.md`) — Touchline primitives and Event
  detail composition (Event day leads Overview, above administration); reused unmodified.
- ADR-0152 (`0152-coach-learning-loop.md`) §2 — `isLive`/`livePrimaryAction` come from the
  canonical live-session resolver; the fixture derives them through the same pure resolver.
- ADR-0157 (`0157-contextual-coach-workspace-convergence.md`) — contextual workspace, no new
  navigation destination; respected (no new route, no "More" navigation).
- ADR-0159 (`0159-visual-authority-gate-and-deliberate-pr-review-deployments.md`) — every E02
  candidate is `CANDIDATE`; approval is the owner's PR comment only.
- ADR-0001 / ADR-0003 — `REPORTED` and `LOCKED` are both completed results; "DRAFT reports show
  nothing". These drive the report-state rules in `TEMPORAL_AND_LIFECYCLE_AUDIT.md`.
- ADR-0137 — `MATCHBOARD_DISPLAY_TIMEZONE` (Europe/Oslo).

## 7. Outcome

All sources were recovered and read; XR-T01, XR-S01 and XR-V02 are quoted above. No acceptance
criterion was inferred from a requirement ID alone. How each is applied:

- **XR-T01** — one chronology with differentiated past/current/next states, text kickers, NEXT,
  deterministic order, no fabricated duration or schedule item (`TEMPORAL_AND_LIFECYCLE_AUDIT.md`).
- **XR-S01** — "side-by-side planned/live/completed versions of one fixture remain recognizably the
  same object". The three child candidates are **the same Event day** (same Event, squads and nine
  match ids/opponents/kickoffs, `shared/event-day-schedule.ts`) observed at 08:00, 11:30 and 18:00.
  The designated continuity match `gate-e-w2-e02-m06` (11:20 Blå vs Kvisten IL) is scheduled →
  live → LOCKED 2–1 across them, rendered by the same `ScorebookMatchRow` identity each time, and
  each capture run selects it in all three states. Tests assert identical identity fields with
  differing lifecycle across fixtures. (Correction: the first revision of this PR used three
  unrelated schedules and enforced that no id was shared — the opposite of XR-S01 — while this
  section claimed the XRs were "applied as written". The independent review caught it (M1); the
  fixtures were redesigned as described.) What is not shown: Today/Match Details versions of the
  same match, which are outside this UI-Lab-only Event wave.
- **XR-V02** — partially. Event → match → back preserves the Event, selection and focus, and the
  outbound live-reporting link is the real route; the full cross-route journey through production
  workspaces cannot be demonstrated here (`BLOCKERS.md` BLK-E02-02).

Capabilities production lacks (an Event Match Detail destination, per-match selection state) are
recorded in `BLOCKERS.md`, not invented.
