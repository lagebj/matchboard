# Gate B W4 — Scenario Register (verbatim extract)

Source: `docs/ui-lab/gate-b-w3-candidates/SCENARIO_REGISTER.md`, itself a re-read of
`docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`'s own verbatim extract of
`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/
25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`. That `.matchboard-work/` handoff directory is not present
in this repository checkout, so this wave recovers the B07 row the same way W3 recovered B06's —
by re-reading a prior wave's own committed verbatim extract, not the original CSV. The B07 row
text is identical, byte-for-byte, across all three prior register files (W1/W2/W3), which is the
same disclosed provenance limitation each of those waves already carried forward.

All rows below: `gate=B`, `status=Needs golden`, `capture_wave=GATE_B`,
`direction_status=DIRECTIONAL_ONLY`, `official_golden_status=NOT_READY`,
`source_commit=b070df73664d816f1b0ebc61d54487a24044972e`. B07's `family` is `Match Details`
(same as every Gate B row except B06).

## Implemented in this wave (B07)

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B07 | Match Details, Assistant Coach longitudinal match context / Historical pattern vs trivial hat-trick fact / Desktop+mobile | "Shows cross-match/multi-source interpretation only, not narrative duplication of goal events" | `Post-match context; Match Insights; CompletedMatchAdvisorPanel` |

## Still deferred (B08) — not deleted from scope

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B08 | Match Details, Information ownership and transitions / Before/live/after/report draft/completed / Desktop+mobile both themes | "Curated Overview vs factual Events/Stats vs reflection vs editable report, no duplication (XR-I02: distinct Live/Report workspaces preserve origin, return and drafts)" | `ADR-0147; match-detail-tabs.ts; report shell` |

## Scope note specific to B07

The row's own component-ownership reference ("Post-match context; Match Insights;
CompletedMatchAdvisorPanel") names three things design-audit (`CURRENT_STATE_AUDIT.md`) confirmed
are genuinely separate: the completed-match Overview's own factual composition, the real
`CompletedMatchAdvisorPanel`/`getCompletedMatchAdvisorViewModel()` (ADR-0152), and before-match
Match Insights (ADR-0149) — a different component family on a different route, never mounted
here. "Match Insights" in the row is read as the register's shorthand for "the AI-interpretation
layer generally," not a literal instruction to reuse the before-match component, consistent with
the real repository's own separation between the two.
