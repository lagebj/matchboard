# Gate B W2 — Scenario Register (verbatim extract)

Source: the same official register Gate B W1 recovered and quoted verbatim —
`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`
— **not independently re-read in this session**; that exact bundle directory is not present on
this machine (gitignored working documents, per ADR-0152's own precedent for the same class of
source). Reproduced here from `docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`'s own
verbatim quote of the same row, which this session did read and verify — see
`SOURCE_RECONCILIATION.md` for the full disclosure.

All rows below: `gate=B`, `family=Match Details`, `status=Needs golden`, `capture_wave=GATE_B`,
`direction_status=DIRECTIONAL_ONLY`, `official_golden_status=NOT_READY`,
`source_commit=b070df73664d816f1b0ebc61d54487a24044972e`.

## Implemented in this wave (B05)

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B05 | Post-match Report / Draft and completed / Editable vs locked / Desktop dark + mobile light | "Finish/report actions versus read-only knowledge" | `post-match shell, ADR-0147/0152` |

## Still deferred (B06-B08) — not deleted from scope

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B06 | League/Event match comparison / Same workflow stages / Before+after / Mobile + desktop | "Same-match identity and lifecycles coherent across League/Event origins; context/back continuity (XR-S01 XR-V02)" | `League/Event report and live adapters, ADR-0158` |
| B07 | Match Details, Assistant Coach longitudinal match context / Historical pattern vs trivial hat-trick fact / Desktop+mobile | "Shows cross-match/multi-source interpretation only, not narrative duplication of goal events" | `Post-match context; Match Insights; CompletedMatchAdvisorPanel` |
| B08 | Match Details, Information ownership and transitions / Before/live/after/report draft/completed / Desktop+mobile both themes | "Curated Overview vs factual Events/Stats vs reflection vs editable report, no duplication (XR-I02: distinct Live/Report workspaces preserve origin, return and drafts)" | `ADR-0147; match-detail-tabs.ts; report shell` |

"Desktop dark + mobile light" (B05's own illustrative pairing, same convention as B01-B04's own
rows) does not restrict what the CI capture script actually captures — like every other Gate B
scenario, every viewport × both themes is captured; see `DATA_TRUTH_AND_FIXTURES.md`.

## B05 is one report's own lifecycle, not two different matches

Unlike B01-B04 (four different matches), B05's register row is specifically about one report
("Draft and completed... Editable vs locked") moving through its own real lifecycle. This wave's
`draft/` and `completed/` share one match identity (`match-gate-b-05`), squad, score, and debrief
— see `DATA_TRUTH_AND_FIXTURES.md`.
