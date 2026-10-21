# Gate B W3 — Scenario Register (verbatim extract)

Source: `docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`, itself sourced from
`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/
25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`. That `.matchboard-work/` handoff directory is not present
in this repository checkout, so this wave recovers the B06 row by re-reading the W1 register
document's own verbatim extract rather than re-reading the original CSV — see
SOURCE_RECONCILIATION.md for the provenance chain.

All rows below: `gate=B`, `status=Needs golden`, `capture_wave=GATE_B`,
`direction_status=DIRECTIONAL_ONLY`, `official_golden_status=NOT_READY`,
`source_commit=b070df73664d816f1b0ebc61d54487a24044972e`. B06's `family` is
`League/Event match comparison` — different from the other seven Gate B rows
(`family=Match Details`), reproduced exactly as the CSV has it, not normalized.

## Implemented in this wave (B06)

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B06 | League/Event match comparison / Same workflow stages / Before+after / Mobile + desktop | "Same-match identity and lifecycles coherent across League/Event origins; context/back continuity (XR-S01 XR-V02)" | `League/Event report and live adapters, ADR-0158` |

## Still deferred (B07-B08) — not deleted from scope

| ID | Title | Scope (verbatim) | Owner ref |
|---|---|---|---|
| B07 | Match Details, Assistant Coach longitudinal match context / Historical pattern vs trivial hat-trick fact / Desktop+mobile | "Shows cross-match/multi-source interpretation only, not narrative duplication of goal events" | `Post-match context; Match Insights; CompletedMatchAdvisorPanel` |
| B08 | Match Details, Information ownership and transitions / Before/live/after/report draft/completed / Desktop+mobile both themes | "Curated Overview vs factual Events/Stats vs reflection vs editable report, no duplication (XR-I02: distinct Live/Report workspaces preserve origin, return and drafts)" | `ADR-0147; match-detail-tabs.ts; report shell` |

## Scope note specific to B06

The row says "Before+after," not "all six lifecycle stages as separate pages." This wave
produces the full six-stage parity matrix as a document (`CURRENT_STATE_AUDIT.md`) but only four
UI Lab candidate pages — League Before/After and Event Before/After — matching the register's
own "Before+after" framing. Live Reporting is the same shared production surface for both
origins (`src/components/live-match/live-match-client.tsx`) and is disclosed as a fact on the
Before pages rather than reproduced as a fifth/sixth page, since reproducing identical shared
code would not compare anything.
