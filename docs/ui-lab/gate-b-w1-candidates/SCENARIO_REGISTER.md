# Gate B — Scenario Register (verbatim extract)

Source: `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`.
All rows below: `gate=B`, `family=Match Details` (except B06), `status=Needs golden`,
`capture_wave=GATE_B`, `direction_status=DIRECTIONAL_ONLY`, `official_golden_status=NOT_READY`,
`source_commit=b070df73664d816f1b0ebc61d54487a24044972e`.

## Implemented in this wave (B01-B04)

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B01 | Before match planned / Preparation ready / Desktop dark + mobile dark | "Preserve stable match identity while prioritizing kickoff/plan/opponent and task; compare to same fixture AFTER (XR-S01 XR-V01) (XR-I01: Edit Lineup opens local tactical editor; no separate lineup route)" | `match-detail-shell, before-match-overview, MatchInsights` |
| B02 | Before match incomplete / Missing plan or data / Desktop light + mobile light | "Honest missing readiness, no invented checklists" | `MatchDetail BEFORE state, ADR-0147` |
| B03 | Completed with sparse events / 6-4 / one recorded event / Desktop dark + mobile dark | "6–4 one recorded event: final result separate from partial chronology; completed priority distinct from BEFORE (XR-T02 XR-S01)" | `after-match-overview, match-flow, source screenshot` |
| B04 | Completed with richer evidence / Synthetic canonical fixture / Desktop light + mobile light | "Meaningful recorded chronology, comparable measures and earned findings with source drilldown, not forced chart panel (XR-T02 XR-A01 XR-A04)" | `after-match-overview, ADR-0152/0157` |

## Deferred (B05-B08) — not deleted from scope

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B05 | Post-match Report / Draft and completed / Editable vs locked / Desktop dark + mobile light | "Finish/report actions versus read-only knowledge" | `post-match shell, ADR-0147/0152` |
| B06 | League/Event match comparison / Same workflow stages / Before+after / Mobile + desktop | "Same-match identity and lifecycles coherent across League/Event origins; context/back continuity (XR-S01 XR-V02)" | `League/Event report and live adapters, ADR-0158` |
| B07 | Match Details, Assistant Coach longitudinal match context / Historical pattern vs trivial hat-trick fact / Desktop+mobile | "Shows cross-match/multi-source interpretation only, not narrative duplication of goal events" | `Post-match context; Match Insights; CompletedMatchAdvisorPanel` |
| B08 | Match Details, Information ownership and transitions / Before/live/after/report draft/completed / Desktop+mobile both themes | "Curated Overview vs factual Events/Stats vs reflection vs editable report, no duplication (XR-I02: distinct Live/Report workspaces preserve origin, return and drafts)" | `ADR-0147; match-detail-tabs.ts; report shell` |

B06's gate is listed as `B` with a different `family` ("League/Event match comparison") from the
other seven rows (`family=Match Details`) — reproduced exactly as the CSV has it, not normalized.

No Gate B sub-wave numbering (e.g. "W1"/"W2") exists in the official register itself; "W1" in
this wave's directory name (`gate-b-w1-candidates`) is this PR's own label for "the first Gate B
PR," following the Gate A directory-naming convention, not a recovered register field.

## B01's AFTER-state companion (B1-R4, independent review remediation)

`b01-planned-ready/after/` is not a new Bxx scenario — it's an implementation detail of B01's own
row, which requires "compare to same fixture AFTER (XR-S01 XR-V01)." It shares B01's exact match
identity, just with the lifecycle-legitimate fields updated to `done`/recorded result.
