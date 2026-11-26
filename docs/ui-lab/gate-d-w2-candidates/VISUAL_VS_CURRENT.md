# Gate D W2 — Visual vs. Current (design acceptance, production capability, operational verification)

Separates three things every candidate conflates if not kept explicit: what the *design* requires,
what *production* actually does today, and what has been *operationally verified* (tests, CI
captures) versus merely asserted.

## D03

| | Design acceptance (register + XR-A01/A04) | Production capability today | Operationally verified |
|---|---|---|---|
| Existing coach focus vs. AI hypothesis distinction | Required | Both rendered in the real Development tab already; never visually merged | Component tests assert both texts render with distinct framing copy |
| Longitudinal comparison with stated window/units/coverage | Required (XR-A01) | `DerivedTrend`/`getPlayerTrendStories()` compute real comparison windows; this wave's fixture-level `FixtureSourceRecord.detail` states the same discipline in UI Lab prose | Fixture test asserts the detail text contains both window phrases and a coverage statement, and (remediation, finding P2 #3) that the unit matches the actual measurement — D03-GROUNDED's giveaways are now described as a count, not a mislabelled rate; D03-DECISION-FLOW's trailing-event hypothesis states a real rate with numerator, denominator and units |
| Accurate time-window duration in rendered copy | Required (XR-A01: "time periods… explicit") | N/A — this is a fixture-authoring correctness requirement, not a production capability | Remediation, finding P2 #4: `cycleWindowWeeks` is computed from the fixture's own date boundaries and asserted equal to 6 — the prior "five-week" literal is gone |
| Every hypothesis backed by a resolvable source | Required (mission §3: "a plausible-looking source label without a corresponding source record" is prohibited) | N/A — fixture-authoring requirement | Remediation, finding P1 #1: D03-DECISION-FLOW had **no** `EvidenceSourceMap` at this PR's first version — confirmed by this wave's own independent review and by the owner's subsequent review. Now backed by a full source map, independently verified by `resolveEvidenceSource` in a dedicated test suite |
| Honest insufficiency state, no padding (XR-A04) | Required | **Not satisfied today** — an empty hypotheses array renders nothing (`CURRENT_STATE_AUDIT.md`) | This wave's `NoDefensibleHypothesis` is a disclosed directional answer, not a production capability |
| Promote/Dismiss/failure interaction | Required | Real, already shipped (`AssistantCoachHypothesisPanel`) | Component tests + Playwright, both confirmed green by the real CI run; no real Server Action invoked |
| Claims only concern the one player the hypothesis is about | Required (no invented cross-player/squad-wide comparison) | N/A — fixture-authoring requirement | Remediation (owner review 2026-11-26): D03-DECISION-FLOW's trailing-event hypothesis previously claimed an unsupported teammate comparison; D03-GROUNDED's learning-cycle insight previously claimed an unsupported squad-wide pattern. Both corrected to player-specific statements; a bounded audit of the remaining five scenarios found no further instance |

## D06

| | Design acceptance (register) | Production capability today | Operationally verified |
|---|---|---|---|
| Trend + observation + position-history synthesis | Required | All three evidence kinds exist as real, independently computed data (`DerivedTrend`, qualitative observations, `ActualPositionInterval`) | Fixture tests assert three distinct kinds are cited, each resolving to a real source record |
| Source-linked story | Required | **Not satisfied today** — `EvidenceRef` has no navigable field; evidence is a text label only (`CURRENT_STATE_AUDIT.md`) | This wave's `EvidenceSourceInspector` is explicitly disclosed, on every page it renders on, as a UI Lab directional presentation, never claimed as production |
| Genuine contradiction, not silently resolved | Required | ADR-0155 §9 states the rule; no existing candidate had demonstrated it for this panel | Fixture test asserts both contradicting sources are present and the statement names both dates; component test asserts both render in the DOM |
| Coach judgment correctly distinguished from canonical fact | Required (ADR-0155/ADR-0157's knowledge hierarchy) | **Not satisfied at this PR's first version** — the source inspector's pill label was derived from fixture `provenance` (RECORDED/DERIVED), so a `HUMAN_ASSESSMENT` rendered as "Recorded fact" (finding P1 #2, owner review). Corrected: label is now derived from `EvidenceRef.kind` | Exhaustive component test covers every real `EvidenceRef.kind` (`w2-shared/__tests__/evidence-source-detail.test.tsx`); D06-CONTRADICTION's own test and a dedicated Playwright test assert the assessment never renders as "Recorded fact" |
| Sparse cross-source, gap kinds distinguishable | Required | N/A — this is a presentation requirement over data that may or may not exist in a given case | Fixture + component tests assert all four gap-category prefixes render as separate facts |
| 14-role profile language vs. 24-code exact evidence | Required (ADR-0160 §6) | The mapping function (`collapseTacticalToProfile`) is real and already reused by Wave 1's D01/D02; not a production *caller* path (only reused inside UI Lab so far) | Fixture tests call the real function directly and assert the exact-evidence text keeps its 24-code label |

## What is explicitly NOT claimed

- Neither family claims the real `AssistantCoachHypothesisPanel` or its readers were modified —
  they were not; every file under `src/components/ai/` and `src/lib/ai/presentation/` is
  untouched by this wave.
- `EvidenceSourceInspector` is never described as a production component anywhere in this wave's
  code or docs — every page that renders it also renders an on-page disclosure sentence to that
  effect.
- `NoDefensibleHypothesis` is never described as matching an existing OFF/EMPTY/ERROR/STALE
  production state machine — Player Detail's hypothesis reader has no such state machine today
  (`CURRENT_STATE_AUDIT.md`).
- A green CI run or a passing test suite is not, by itself, a visual approval — see
  `docs/development/coding-agent-working-session.md`'s Visual Authority Gate section; no
  `/visual-approve` or `/visual-reject` is posted by this wave's implementation.
