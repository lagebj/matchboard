# Gate B W5 — Scenario Register (B08)

Source: official register row B08 (reproduced verbatim in `docs/ui-lab/gate-b-w1-candidates/
SCENARIO_REGISTER.md`'s own "Deferred (B05-B08)" table — no second copy invented here):

> B08 | Match Details, Information ownership and transitions / Before/live/after/report draft/
> completed / Desktop+mobile both themes | "Curated Overview vs factual Events/Stats vs reflection
> vs editable report, no duplication (XR-I02: distinct Live/Report workspaces preserve origin,
> return and drafts)" | `ADR-0147; match-detail-tabs.ts; report shell`

B08 is the final Gate B candidate wave — W1 (B01-B04), W2 (B05), W3 (B06), W4 (B07) are all
implemented and merged (`main` at `dc772b2aa`); B08 is the last deferred row.

## Official B08 candidates implemented in this wave

| ID | Route | Lifecycle state | Main question |
|---|---|---|---|
| B08-BEFORE | `/dev/ui-lab/gate-b/b08-information-ownership/before` | `planning_open` | What is the coach preparing, and where does live work begin? |
| B08-LIVE | `/dev/ui-lab/gate-b/b08-information-ownership/live` | active reporting session | Where does reporting happen, and how does the coach return? |
| B08-AFTER | `/dev/ui-lab/gate-b/b08-information-ownership/after` | `report_incomplete` | What is recorded, what is still missing, and what action is next? |
| B08-REPORT-DRAFT | `/dev/ui-lab/gate-b/b08-information-ownership/report-draft` | `REPORTED` (DRAFT) | What can be changed, and what prevents completion? |
| B08-REPORT-COMPLETED | `/dev/ui-lab/gate-b/b08-information-ownership/report-completed` | `LOCKED` (COMPLETED) | What is now final, and where is the historical record? |

All five share one canonical match identity (`B08_MATCH_ID`/`B08_REPORT_ID`,
`shared/fixture.ts`/`fixture-history.ts`) — the same match at five real observation instants, never
five unrelated examples.

## Companion page — not an official scenario

B08-LIVE's own page includes a small read-only "follower view" summary panel (built from the real
`MatchScoreHeader`) to demonstrate the reporter-vs-follower distinction the spec asks for. This is
an implementation detail of the B08-LIVE row, exactly the same status B01's own AFTER-state
companion (`b01-planned-ready/after/`) holds relative to B01 — it is not a sixth official register
row, carries no separate scenario ID, and is not registered as its own entry in `candidate_manifest.json`.

## Non-goals carried over from the task brief, reconfirmed here

- No new Event Match Details route. B06's existing League/Event parity comparison
  (`b06-league-event-parity/`) is reused and cited (`TRANSITION_AND_NAVIGATION_CONTRACT.md`), not
  re-solved.
- No third `LIVE` Match Details composition — Match Details stays BEFORE/AFTER only; Live Reporting
  remains its own separate workspace (ADR-0147, reconfirmed in `CURRENT_STATE_AUDIT.md` §1).
- No merge of Live Reporting into Match Details, and no merge of the Report into AFTER Overview.
