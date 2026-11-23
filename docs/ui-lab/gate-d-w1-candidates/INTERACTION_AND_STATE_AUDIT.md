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

## D02 — Evidence position-dot consolidation

**Expected interaction**: none — `EvidenceStory`, `Sparkline`, and `StackedDistribution` are all
pure display components with no interactive affordances of their own.

**Implemented**: none beyond render verification. Tests assert the real insufficient-evidence
state renders for `confidence: null` stories, that a group with zero stories is omitted entirely
rather than shown as an empty card, and that the Position story's exact sided codes remain
individually visible in the consolidated visual (never merged/double-counted).

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

## Summary

No scenario in this wave claims authenticated browser-level interaction evidence or a real
Server Action call. The only simulated interaction surface (D01's position editor) is explicitly
disclosed on-page and in this document, matching the precedent set by Gate C W3's C07-ON
candidate for its own simulated Promote/Dismiss actions.
