# Gate D W2 — Visual vs. Current (design acceptance, production capability, operational verification)

Separates three things every candidate conflates if not kept explicit: what the *design* requires,
what *production* actually does today, and what has been *operationally verified* (tests, CI
captures) versus merely asserted.

## D03

| | Design acceptance (register + XR-A01/A04) | Production capability today | Operationally verified |
|---|---|---|---|
| Existing coach focus vs. AI hypothesis distinction | Required | Both rendered in the real Development tab already; never visually merged | Component tests assert both texts render with distinct framing copy |
| Longitudinal comparison with stated window/units/coverage | Required (XR-A01) | `DerivedTrend`/`getPlayerTrendStories()` compute real comparison windows; this wave's fixture-level `FixtureSourceRecord.detail` states the same discipline in UI Lab prose | Fixture test asserts the detail text contains both window phrases and a coverage statement |
| Honest insufficiency state, no padding (XR-A04) | Required | **Not satisfied today** — an empty hypotheses array renders nothing (`CURRENT_STATE_AUDIT.md`) | This wave's `NoDefensibleHypothesis` is a disclosed directional answer, not a production capability |
| Promote/Dismiss/failure interaction | Required | Real, already shipped (`AssistantCoachHypothesisPanel`) | Component tests + Playwright, both confirmed green by the real CI run; no real Server Action invoked |

## D06

| | Design acceptance (register) | Production capability today | Operationally verified |
|---|---|---|---|
| Trend + observation + position-history synthesis | Required | All three evidence kinds exist as real, independently computed data (`DerivedTrend`, qualitative observations, `ActualPositionInterval`) | Fixture tests assert three distinct kinds are cited, each resolving to a real source record |
| Source-linked story | Required | **Not satisfied today** — `EvidenceRef` has no navigable field; evidence is a text label only (`CURRENT_STATE_AUDIT.md`) | This wave's `EvidenceSourceInspector` is explicitly disclosed, on every page it renders on, as a UI Lab directional presentation, never claimed as production |
| Genuine contradiction, not silently resolved | Required | ADR-0155 §9 states the rule; no existing candidate had demonstrated it for this panel | Fixture test asserts both contradicting sources are present and the statement names both dates; component test asserts both render in the DOM |
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
