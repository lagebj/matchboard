# Gate D W1 — Interaction and State Audit

All three scenarios in this wave are read-only presentation per `WAVE_SCOPE.md` ("none of the
three are expected to need a mutation handler at all"). This audit confirms that stayed true
during implementation and states explicitly what interaction coverage exists, rather than
inventing interactions beyond the official contract (mission brief §7: "do not add unnecessary
interaction requirements beyond the official contract").

## D01 — Overview position evidence

**Expected interaction**: none required by the acceptance question (it is about what renders,
not about an interaction flow). `PlayerPositionMapWidget`/`TouchlinePositionMap` do support an
optional position-select-to-highlight interaction (real production behavior, unchanged) — this
wave does not add a dedicated test for that click behavior because it is not what D01's
acceptance question is asking about, and it already exists, unmodified, exercised by prior
Gate A–C captures of the same shared component family.

**Implemented**: `PlayerPositionProfile`'s declared-position editor is real production UI with
real inline-edit interaction. Per the Gate C W3 lesson (a Server Component cannot pass a plain
function prop to a Client Component — confirmed to crash a real CI capture while being invisible
to jsdom tests), this wave mounts it through `PlayerPositionProfileMount`
(`src/app/dev/ui-lab/gate-d/shared/player-position-profile-mount.tsx`, `"use client"`), which
constructs a simulated `updateFieldAction` locally rather than receiving one as a prop. This is
disclosed on-page ("The position editor below is simulated...") and tested
(`discloses that the position editor is simulated`). No real Server Action is called by either
D01 scenario; no player record is written.

**Remediation (2026-11-24)**: `ProfileRoleSummary` adds one native, non-mutating interaction — a
`<details>` disclosure toggling the exact-tactical-evidence drill-down. Not a Server Action, not
a mutation handler; tested the same way as D02's drill-down below (content present in the DOM
regardless of open/collapsed state).

## D02 — Evidence position-dot consolidation

**Expected interaction**: none — `EvidenceStory`, `Sparkline`, and `StackedDistribution` are all
pure display components with no interactive affordances of their own.

**Implemented**: none beyond render verification (plus the native `<details>` drill-down added by
remediation, below). Tests assert the real insufficient-evidence state renders for
`confidence: null` stories, and that a group with zero stories is omitted entirely rather than
shown as an empty card.

**Remediation (2026-11-24)**: the POSITION story's visual is now a real profile-level
consolidation (`ConsolidatedPositionEvidence`) with the exact sided breakdown moved into a
`<details>` drill-down — not merged away, not duplicated into the profile-level total. A new
`profile-consolidation.test.tsx` asserts the drill-down's content is queryable in the DOM
regardless of its open/collapsed state (native disclosure, no JS interaction handler, no mutation).

## D04 — Matches minute coverage

**Expected interaction**: `PlayerMatchTimeline` renders each match row as a `Link` to the match's
own page — real navigation behavior, unchanged. This wave does not add a dedicated navigation
test because the acceptance question is about coverage *rendering* (minutes/positions vs. not
recorded), not about the pre-existing link-navigation behavior, which is not Gate D's to
re-verify.

**Implemented**: render verification only, confirming minutes/position presence or absence
renders exactly as the real data implies — a `minutes: null` match never shows a fabricated `0'`,
and a match with no actual position shows the real "No actual position recorded" text rather
than an inferred value.

## D07 — Attribute evolution review (extension, 2026-11-23; remediated 2026-11-24)

**`GATE-D-W1-D07-AUTOMATIC`**: no interaction — `AssessmentHistoryDisplay` is pure display.

**`GATE-D-W1-D07-MATERIAL`**: `MaterialApprovalReview` implements simulated Accept/Reject,
constructed as local client-side state inside its own `"use client"` component — never a function
prop received from a server `page.tsx`, following the same RSC-boundary discipline as D01's
`PlayerPositionProfileMount`. Each button click updates local `decision` state and renders a
`data-testid="decision-result"` confirmation; no Server Action is called, no `AssessmentChange`
row is written. Tested directly, including (added 2026-11-24): a test confirming the displayed
"current applied value" does not retroactively change when a decision is made, and a test
spying on `global.fetch` to confirm no network request is made by either button. The underlying
threshold math (`materiality-policy.ts`) is independently unit-tested, not just exercised through
the rendered component.

**`GATE-D-W1-D07-REBASE`** (new, 2026-11-24): `AttributeRebasePanel` implements simulated
Unlock, same local-client-state, no-Server-Action discipline. Four fixture rows exercise, in one
screen: a manually-edited attribute not yet eligible to resume automation, a manually-edited
attribute that is eligible, an unaffected attribute continuing its own independent progression,
and a locked attribute (plus simulated unlocking). Tested directly, including a `fetch` spy
confirming unlocking makes no network request.

## D08 — Primary position proposal (extension, 2026-11-23)

Both states implement simulated Accept/Reject/Defer via `PositionProposalReview`, same local
client-state pattern as D07's `MaterialApprovalReview`. No Server Action is called, no
`Player.primaryPosition` or `DecisionRecord` row is written. Tested directly for both accept
(`GATE-D-W1-D08-STRONG`) and defer (`GATE-D-W1-D08-CONFLICT`).

## D09 — Evidence lineage (extension, 2026-11-23; expanded 2026-11-24)

**`GATE-D-W1-D09-LINEAGE`**: `EvidenceLineageDisplay` is now interactive (`interactive` prop).
Edit opens an inline textarea and, on save, supersedes the active entry and adds a new active one
with the edited wording; Retract supersedes the active entry with nothing replacing it. Both are
simulated local client state — no `recordDeterministicExtraction()` call, no database write.
Tested directly: Retract leaves no `Active` label and the entry's statement renders
struck-through; Edit's new wording appears and the prior wording remains visible, struck through,
not deleted.

**`GATE-D-W1-D09-AMBIGUOUS`** (new, 2026-11-24): read-only — `RejectedExtractionDisplay` shows a
submitted text and its rejection reason, with zero resulting observations. No interaction is
implemented because none is normatively required: the acceptance question here is about a
rejection outcome being rendered honestly, not about a user action.

## Summary

No scenario in this wave claims authenticated browser-level interaction evidence or a real
Server Action call. D01's position editor, D07's accept/reject/unlock, D08's accept/reject/defer,
and D09's edit/retract are the simulated interaction surfaces — each explicitly disclosed on-page
and in this document, matching the precedent set by Gate C W3's C07-ON candidate for its own
simulated Promote/Dismiss
actions.
