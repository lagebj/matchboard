# Gate B W2 — Interaction and State Audit

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
