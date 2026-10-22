# Gate B W2 — Interaction and State Audit

## Fourth remediation pass (R9-1) — no interaction-model change

R9-1 corrects the combination-evidence source data's own internal consistency (positional
segments vs. pre-existing player minutes) — a fixture data correction, not an interaction-model
change. Every reachable control remains exactly as audited below. See
`SOURCE_RECONCILIATION.md`'s own "fourth remediation pass" section.

## Third remediation pass (R8-1, R8-2) — the interaction model, corrected further

Two more real gaps, beyond what the second pass fixed: (1) the LOCKED-state disclosure
(`GoalDiscrepancyDisclosure`) reused the editable-state component's own wording, which told the
coach to complete an already-completed report — now genuinely state-aware, with locked wording
that instructs reopening first (R8-1); (2) `addPlayer()` could add ANY string as a "player" (no
eligibility check, raw id displayed as the name), and `reopen()` could transition a LOCKED report
to LOCKED again with cleared completion metadata — both now validated by the central reducer at
runtime, independent of whichever UI control currently gates the call (R8-2). See
`SOURCE_RECONCILIATION.md`'s own "third remediation pass" section.

## Second remediation pass (B5/R1, B5/R3) — the interaction model, corrected further

Two real gaps found in the lifecycle simulation described below, beyond what B2-R3/R5 already
fixed: (1) only `addGoal()` checked for `LOCKED` state — every other mutation (`updateResult`,
`removeGoal`, `addAssist`, `removeAssist`, `updateAttendance`, `addPlayer`, `removePlayer`,
`confirmPeriodTiming`, `correctPeriodTiming`) did not, reachable because the real shared
`PostMatchReportShell` only hides their UI controls, not the action layer itself (B5/R3); (2) the
interaction demonstrated only ONE of the two real outcomes `complete()` actually allows — a
report can legally lock with the goal-attribution gap still open, and the capture script never
exercised that path at all (B5/R1). Both corrected: one central validator now enforces every
mutation's lifecycle rule, and the capture script drives two real sequential states from one page
load (confirm-only-then-complete, producing the still-unresolved disclosure; then
reopen-add-the-real-goal-then-complete-again, producing the reconciled state). See
`SOURCE_RECONCILIATION.md` for the full record.

## fixtureVersion 2 — the interaction model is now a real lifecycle simulation (B2-R3/R5)

The whole-fixture-swap interaction described below (section "The lifecycle-transition
interaction") is **superseded**. The remediated draft page's Players tab now exposes a genuine,
deterministic, fixture-local lifecycle (`shared/use-safe-report-lifecycle.ts`):

- "Complete report" genuinely rejects while the one timing-review period still needs review,
  with the same error framing the real `completeReport()`/`getTimingSubmissionBlockers()` gate
  produces — report state is unchanged on rejection.
- "Confirm duration" (the real `RecoveredTimingCallout` control) resolves that blocker in place.
- "Add goal" (the real `PostMatchReportShell` control) independently resolves the
  goal-attribution gap — confirmed, by reading the real `completeReport()` source, that this gap
  is advisory in real production, never itself a completion blocker; the simulation does not
  invent a stricter gate than production actually enforces.
- Only once the timing blocker is resolved does "Complete report" succeed, transitioning status
  to LOCKED in place (no whole-fixture swap, no navigation) and revealing "Reopen report" — wired
  to the same fixture-local lifecycle, never a real production action (B2-R5).

Covered by `draft/__tests__/page.test.tsx`'s own new test cases. The Players-tab URL-pinning
behavior (ADR-0147 §1b) is preserved by the new `shared/safe-post-match-report-shell.tsx`, which
replicates the real shell's own pinning effect.

## Original wave (fixtureVersion 1) — superseded by the above

## The lifecycle-transition interaction (draft only)

`draft/page.tsx` renders a UI-Lab-local "Continue fixture simulation → Complete report" control
(same grammar A07/B01 established — never the real `Complete report` button, never a production
mutation). Clicking it swaps the page's local React state from this scenario's own fixture module
to `../completed/fixtures`' module — the same real match, now locked — entirely client-side. This
is the one new interaction grammar this wave adds: a whole-fixture swap rather than a single
reducer field update, because the thing being demonstrated (a report's own real lifecycle
transition) genuinely changes report status, goal attribution, timing review, and
`completedBy`/`completedAt` together, not one field in isolation.

Covered by `draft/__tests__/page.test.tsx`: clicking the control flips the visible
"Surface state: DRAFT/COMPLETED" indicator, removes the (DRAFT-only) goal-attribution-gap banner,
and — the actual regression this proves — the Players tab stays selected and pinned
(`?tab=players` is set once, on mount, and never re-pinned by the transition), exactly matching
`post-match-report-page-shell.test.tsx`'s own real coverage of this exact bug (ADR-0147 §1b).

## Default tab per lifecycle state (real, unmodified `getPostMatchReportDefaultTab()`)

| Scenario | Default tab | Why |
|---|---|---|
| B05 (draft) | `players` | ADR-0003/ADR-0147 §1a — the completion action must be immediately reachable with zero extra clicks |
| B05-COMPLETED | `summary` | No completion-action urgency once locked; matches the golden's own illustrated tab |

Neither value is asserted by this wave's own code — both come from the real
`getPostMatchReportDefaultTab()` function, unmodified, called by the real
`PostMatchReportPageShell`.

## Draft-only vs. completed-only real content

- `Review` tab — DRAFT only (real tab set difference, `POST_MATCH_DRAFT_TABS` vs
  `POST_MATCH_COMPLETED_TABS`). Renders the real `PostMatchReviewTab` (a link into `/review`, not
  a second render of its content — unchanged from how Gate B W1 already described this
  component).
- `Combinations` tab — COMPLETED only, same real tab-set difference. Renders the real
  `MatchCombinationEvidencePanel`.
- `GoalAttributionGapBanner` — only when `isDraft` (the shell's own real `{isDraft && (...)}`
  guard); absent once locked in this wave's completed fixture because the real gap is resolved,
  not because the banner was hidden.
- `Complete report` / `Reopen report` buttons — the real `PostMatchReportShell`'s own status-gated
  rendering (`submitAction = (isDraft || isReported) && (...)`, `reopenAction = isLocked && (...)`)
  — unmodified. `Reopen report` is a genuine real production affordance once locked (a lifecycle
  action, not a draft mutation control) and is correctly still present in the completed fixture —
  not omitted to make "read-only" look more absolute than production actually is.

## Keyboard/focus/accessibility

No new interactive grammar beyond the one click described above; every control this wave renders
is a real, unmodified production component with its own existing accessibility behavior
(native `<button>`s, the real `TabRail`'s `role="tab"`-equivalent pill buttons). No new
disclosure/dialog/inspector pattern is introduced.

## Context-local vs. non-actionable states

The draft page has exactly one legitimate non-production action (the fixture-simulation control)
plus the real, reachable `Complete report`/goal/assist/attendance editor (never clicked in tests
or captures, per `DATA_TRUTH_AND_FIXTURES.md`). The completed page has none — a locked report is
read-only in production too.
