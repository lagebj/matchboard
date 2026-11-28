# Gate E W2 — Design Acceptance vs. Production Capability vs. Operational Verification (E02)

These three claims are kept separate, as in W1.

## Current-state baseline (XR-V01)

No current-state screenshot of production Event Detail with comparable data exists in this
repository: production's Event day is only rendered after a real authenticated fetch, and this wave
touches no deployment. Baseline status: `NO_BASELINE_CAPABILITY` for a rendered comparison. The
current behaviour is instead described from the code (`CURRENT_STATE_AUDIT.md`), which is what the
comparison below uses. The older ADR-0134 UI Lab golden `/dev/ui-lab/event-day` is a directional
study, not a baseline: it hand-writes non-domain items ("Arrival · Meet at main entrance", pitch
numbers) that E02 prohibits.

## Review record (XR-V01's five points)

1. **Primary coach question:** on an Event day with several matches across squads — what has
   happened, what needs my attention, and what comes next?
2. **Current-state deficiency:** a live match reads "FT"; a draft score reads as a final win; a
   REPORTED result is flagged as follow-up; a cancelled match is "LATER"; simultaneous kickoffs have
   no stable order and only one gets NEXT; a timeline row cannot be opened; a failed fetch looks like
   "no matches".
3. **Proposed difference:** canonical live state, report-state-correct results, cancelled shown as
   cancelled, deterministic order with all simultaneous next matches marked, a one-line day summary,
   per-squad progression, and an in-place selected-match context that keeps the Event heading and
   links to the real live/report destinations.
4. **User-impact proof:** component and browser tests listed in `SCENARIO_REGISTER.md`; screenshots
   from CI capture run 46018113731, recorded in `capture-attestation.json`.
5. **Accepted trade-offs:** the selection parameter and context panel are UI-Lab-only; the report
   link opens the Matches tab, not the specific match; production admin blocks are omitted.

## Provenance per displayed capability

| Capability | Provenance |
|---|---|
| Event heading (`TouchlinePageHeader`, context-line format) | Existing production presentation reused |
| Finalised banner (`DecisionBanner`) | Existing production component; last sentence adapted (Unfinalize not rendered) |
| Tab rail with `?tab=` authority (`TabRail`) | Existing production presentation + convention reused; non-overview bodies not reproduced |
| Timeline primitives (`TouchlineTimeline`, `TimelineItem`) | Existing production presentation reused |
| Match rows (`ScorebookMatchRow` from `buildMatchPresentation()`) | Existing production presentation reused; `kickoffDate`/`kickoffTime` replaced with Oslo-pinned values |
| Lifecycle/kicker/NEXT/order projection | Fixture-safe orchestration (stand-in for the private production function), with the disclosed differences in `TEMPORAL_AND_LIFECYCLE_AUDIT.md` |
| Live entry label (`describeLiveReportingEntryPointLabel`) | Existing production logic reused |
| Day summary line, per-squad progression | Directional-only UI Lab presentation |
| Narrow-width "Squad v Opponent" identity line under each row (<600px) | Directional-only UI Lab presentation (works around the shared row's truncation without changing it) |
| Match selection (`match` query) and selected-match context | Directional-only UI Lab interaction |
| Event Match Detail destination | Missing production integration — not shown |
| Scheduled-row layout | Production `ScorebookMatchRow` defect visible in captures (time overlaps "Scheduled"; opponent truncates on mobile) — BLK-E02-08, issue #852 |

**This candidate is not 100% production parity.** It is the proposed E02 Event-day experience built
from real Matchboard presentation primitives, not a screenshot of how production Event Detail looks
today.

## Operational verification

Not performed against a deployed environment. Verification consists of node tests (projection and
the 17 integrity assertions across three fixtures), jsdom component tests, the Gate E Playwright
suite in CI, and the CI capture run. `capture-attestation.json` is the single source of truth for
which capture run and artifact back these candidates.

**Precisely (E02-R6):** *verified* = context preservation within this directional E02 candidate
(Event/squad/match identity across selection, URL state and browser history). *Not verified* = the
complete production journey Event day → Event Match Detail → Live Reporting/report → back to the
selected Event context, because production has no Event Match Detail route (BLK-E02-02). XR-V02 is
directionally demonstrated, not operationally verified.

**Open shared-component defects visible in these captures (not fixed, owner decision):** E02-R1
(scheduled kickoff time overlaps "Scheduled"), E02-R2 (shared row truncates names below 600px —
only mitigated by the UI-Lab identity line), E02-R3 (unqualified "FT" for played-no-report and
draft rows). See `BLOCKERS.md`.

## Summary

| Claim | UPCOMING | MIXED | COMPLETED |
|---|---|---|---|
| Implements the register row's acceptance | Yes | Yes (primary case) | Yes |
| Built on real production presentation components | Yes | Yes | Yes |
| Contains directional-only behaviour | Summary/squad aside, selection | Same | Same |
| Production route changed | No | No | No |
| XR-V02 production journey verified | No — directional only | No — directional only | No — directional only |
| Shared-row defects E02-R1/R2/R3 resolved | No (R1, R2 visible) | No (R1, R2, R3 visible) | No (R2 visible) |
| Owner approval | None — `CANDIDATE` | None — `CANDIDATE` | None — `CANDIDATE` |
