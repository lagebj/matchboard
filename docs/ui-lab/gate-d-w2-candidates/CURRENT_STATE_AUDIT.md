# Gate D Wave 2 — Current-State Audit

For each acceptance requirement: existing production capability, existing production
presentation, missing presentation, missing domain capability, missing operational verification.

## D03 — AI hypothesis and coach focus

**Existing production capability.** Player Detail's `DevelopmentTab`
(`src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx:352-470`) already reads
`getPlayerDevelopmentCycleInsight()` and `getPlayerAssistantCoachHypotheses()` in parallel with
the player's `developmentThread`/`observations` rows, builds a real
`PlayerDevelopmentViewModelInput`, and renders, in order: a Development-focus `TouchlineWidget`,
an optional "Learning cycle" insight widget, the real `AssistantCoachHypothesisPanel`, and
`PlayerDevelopmentTimeline`. This is a genuinely real, already-wired production composition — not
assembled new for this wave.

**Existing production presentation.** `AssistantCoachHypothesisPanel`
(`src/components/ai/assistant-coach-hypothesis-panel.tsx`) renders one card per hypothesis: an
"Assistant Coach hypothesis" pill, an uncertainty label, the statement, a plain-text
"Supporting evidence: …" / "Contradicting: …" line (via `describeRefs()`, line 47-49), disclosed
missing evidence, a fixed "not a confirmed fact" disclaimer, and Promote/Dismiss controls with an
inline development-focus input (`maxLength=200`, Promote disabled until non-empty).

**Missing presentation — confirmed, not assumed.** `getPlayerAssistantCoachHypotheses()`
(`src/lib/ai/presentation/player-assistant-coach-hypotheses.ts:30-43`) returns `[]` when: the
organisation's AI settings are missing/disabled, there is no active provider connection, the
`ASSISTANT_COACH` capability is disabled, or the active connection is not `READY`. All four of
these distinct conditions collapse to the identical empty array at this reader. Downstream,
`AssistantCoachHypothesisPanel` does `if (hypotheses.length === 0) return null;` (line 84) — the
entire section disappears with **no visible distinction between "AI off", "no current
hypothesis", and "evidence too sparse"**. This directly contradicts Wave 1's own
`CURRENT_STATE_AUDIT.md` claim ("Capability gating states are real, named exactly OFF/EMPTY/
ERROR/STALE") for this specific surface — that claim is **not correct for Player Detail's
Development tab** (it describes the real, named `AdvisorPanelUnavailable`/`AdvisorPanelStale`
primitives and the Today-surface `TodayAssistantCoachContext` status model, which are real but are
a *different* AI surface with a richer status-carrying type than this one). This wave corrects the
record rather than carrying the earlier claim forward.

**Missing domain capability.** No status-carrying type exists for
`getPlayerAssistantCoachHypotheses()`'s own read path (no `status: "off" | "empty" | "error" |
"stale"` equivalent to `TodayAssistantCoachContext`). Building one is out of this wave's scope
(§16 of the mission brief: no rework of the production hypothesis generation/status pipeline).

**Missing operational verification.** No existing UI Lab candidate exercised the sparse/
no-hypothesis case, the contradicting-evidence-disclosure case, or the Promote-failure path for
this specific panel before this wave (Gate C W3's C07 exercises the same panel for the *Today*
surface, with a successful promote/dismiss only).

## D06 — Assistant Coach cross-source hypothesis

**Existing production capability.** The same `AssistantCoachHypothesisPanel` and
`getPlayerAssistantCoachHypotheses()` reader — D06 has no separate production owner from D03,
confirmed by the register's own `existing_owner_or_reference` column citing the identical panel
for both rows. "Derived trends and player history" (the register's phrasing) are real,
independently-computed data: `getPlayerTrendStories()`
(`src/lib/development-context/get-player-trend-stories.ts`) persists `DerivedTrend` rows with
real comparison-window math, and `ActualPositionInterval` rows back the real position-evidence
presentation Wave 1's D01/D02 already demonstrated.

**Existing production presentation.** Identical to D03's — one panel, one evidence-citation
style per hypothesis.

**Missing presentation — the register's own "source-linked story" requirement.** `EvidenceRef`
(`src/lib/development-context/types.ts:12-24`) is `{kind, id, occurredAt?, label?}` — **no URL,
route, or navigable field exists.** `describeRefs()` renders it as a comma-joined plain-text
label. Confirmed by direct inspection: there is no click target, no drill-down, no source-detail
view anywhere in production tied to an `EvidenceRef`. **D06's register acceptance question
("source-linked story") is genuinely unsatisfied in production today.** This wave's
`EvidenceSourceInspector` (`src/app/dev/ui-lab/gate-d/w2-shared/evidence-source-detail.tsx`) is a
disclosed directional UI Lab presentation for this requirement, never claimed as an existing
production capability — every rendered source inspector states this on-page.

**Missing domain capability.** No production mechanism resolves an `EvidenceRef` back to a
richer, inspectable record with its own provenance/coverage metadata. This wave's fixture-only
`FixtureSourceRecord`/`resolveEvidenceSource()` (`w2-shared/evidence-source-types.ts`) is a UI Lab
construction over fixture data, not a production read path.

**Missing operational verification.** No existing candidate demonstrated three distinct evidence
kinds cited by one hypothesis without conflating their provenance, a genuine same-claim
contradiction across two coach-sourced judgements (ADR-0155 §9: "history is evidence… never
reconciled away"), or a cross-source sparse state distinguishing missing data / insufficient
sample / no contrary evidence / explicit coach uncertainty as separate facts.

## Capability-gating classification (both D03 and D06)

Classified `IMPLEMENTED_WITH_PRESENTATION_GAP`, consistent with Wave 1's own vocabulary: the real
panel, the real readers, and the real underlying evidence computation all exist and are reused
unmodified; what is missing is (a) a distinguishable off/empty/error/stale presentation at this
specific reader, and (b) a navigable source-detail capability for `EvidenceRef`. Neither gap
requires a schema change, a new Server Action, or a new AI provider — both are presentation-layer
gaps, matching this wave's §16 scope boundary.
