# ADR-0143: Today Matchday pre-live surface and composition dedup

## Status

Accepted

## Context

ADR-0141 established Today as an operational command surface. ADR-0142 fixed its composition ownership: Live Now, Next Action, Selection decisions, remaining concrete planning attention, other concrete attention, and Today in order, in that order, with no generic count-only summaries alongside concrete decisions.

That composition has no first-class pre-live "matchday" surface. A same-day match that is not yet live is only visible as: an entry in the chronological "Today in order" list, whatever concrete selection/planning-attention rows its own plan-integrity signals happen to produce, and (in `TodayNextAction`) an ad hoc `NextMatchHero` fallback that duplicated basic match facts without a deterministic phase model, a readiness summary, or a prominent path into live reporting as kickoff approaches.

Coaches preparing for a same-day match therefore had to piece its status together from several unrelated rows, and had no single, escalating "getting ready for this match" surface the way Live Now is the single surface once a match goes live. League and Event same-day matches were not treated with equivalent standing.

The Today Matchday Follow-up bundle (`.matchboard-work/matchboard_today_matchday_followup_2026-09-15/`) fixes a fully specified design (phase model, readiness contract, action priority, composition anchor, deduplication mechanism) as a deliberately narrow, product-decided follow-up — this ADR records that decision formally because it changes Today's composition contract (ADR-0142) and introduces a new deterministic domain model (the matchday phase) alongside the existing plan-integrity and live-session models.

## Decision

### One additional composition anchor, not a new independent slot

Live Now and Matchday share exactly one top-level anchor position in Today's main column, immediately above Next Action:

- when any same-day match has an active live session, `TodayLiveNow` renders there, exactly as ADR-0142 already specifies, and Matchday is not computed or rendered at all;
- otherwise, when a deterministic featured-match selection identifies one same-day League or Event match, `TodayMatchday` renders there instead;
- otherwise neither renders, and Today's composition is unchanged from ADR-0142.

This keeps ADR-0142's composition order intact: Matchday is a conditional occupant of the existing anchor position, not a sixth ordered slot.

### Deterministic phase model

A same-day match resolves to exactly one of `PREPARE`, `VERIFY`, `IMMINENT`, `LIVE`, or `POST_MATCH`, computed from kickoff time, canonical lifecycle status, and active-live-session state — never from a manually maintained flag. `LIVE` is reachable only through the existing Live Now ownership path above (Matchday itself never renders while `LIVE`). The thresholds (120 minutes to `VERIFY`, 45 minutes to `IMMINENT`) and the full resolution order are implemented in `src/lib/touchline/presentation/today-matchday-phase.ts`.

### Deterministic featured-match selection with League/Event parity

Exactly one same-day match, if any, is featured. Selection is pure and unit-tested (`src/lib/touchline/presentation/today-football-match.ts`): any live match takes the anchor via the existing Live Now path (Matchday returns no selection in that case); otherwise the nearest upcoming same-day match wins; otherwise the most recent same-day match with unresolved post-match closure work; otherwise the most recently completed same-day match as a quiet anchor; otherwise a same-day cancelled match, only when every same-day candidate is cancelled.

League and Event matches are adapted into one shared `TodayFootballMatch` shape before selection, so an Event match can be featured on exactly the same terms as a League match. Where an Event concept has no canonical equivalent (round-based planning-closed state, a doubtful/tentative availability tier, a persisted tactics record), Matchday omits that specific readiness fact for Events rather than fabricating parity with League.

### Readiness reuses existing facts; never invents new domain state

Matchday's readiness summary (squad planned, selected-player availability, lineup, tactics, any match-scoped plan-integrity blocker or decision) is built entirely from facts the app already computes elsewhere — reusing `PlanIntegritySignal`s already scoped to the featured match's round, existing selection/lineup/availability records — never a new manually-ticked checklist and never an invented tactics-readiness state where no canonical tactics record exists.

### One primary action, fixed priority order

Matchday surfaces exactly one primary action, chosen by a fixed priority order (hard match-scoped blocker, then an unavailable selected player, then a doubtful selected player, then a missing lineup, then missing tactics where knowable, then any other concrete match-scoped planning decision, then "Start live reporting" once inside the imminent window, then a plain review/open action). "Start live reporting" links to the same canonical live-entry route Live Now's own "Follow live" action already uses (`/matches/{matchId}/live` for League, `/events/{eventId}/matches/{eventMatchId}/live` for Events) — Matchday introduces no second live-start path.

### Deduplication by consumed identity

Whenever Matchday's primary action represents an existing plan-integrity signal or work item, that signal/work item's identity is excluded from Selection decisions, remaining planning attention, and other attention, so the same obligation is never shown twice. Deduplication is identity-based (signal/work-item id), never text-similarity or "anything referencing the featured match," per ADR-0142's existing decision-anatomy discipline against duplicated obligations.

### Golden reference's anchor composition is unaffected; its lower timeline count intentionally tightens

The approved Today golden/visual-regression fixture already has an active live session occupying the anchor, so it continues to exercise the unchanged `TodayLiveNow` path — Matchday never renders and no new anchor markup appears there. However, §4.7's "one-match rule" (the anchor-owned match is never repeated in the lower chronology) is genuinely new dedup behaviour that also applies when Live Now — not just Matchday — owns the anchor: the golden fixture's "Today in order" panel now excludes that same live match from the lower list, changing its match count. This is a deliberate, spec-required composition change, not a defect, and it means the existing golden pixel baseline (`e2e/today-visual-regression.spec.ts-snapshots/today-primary-chromium-linux.png`) requires a human-approved rebaseline under the same visual-verification-gate process ADR-0142 established, before the visual regression spec will pass again. New Matchday states are captured and reviewed as additional UI-Lab fixtures.

## Consequences

Today gains a single, escalating pre-live surface for a same-day match, consistent for League and Event matches, without duplicating the concrete decisions already produced elsewhere on the page.

The Matchday phase model and featured-match selection are new pure, unit-tested domain logic (`src/lib/touchline/presentation/today-matchday-phase.ts`, `today-football-match.ts`, `today-matchday-readiness.ts`) that other Today-adjacent surfaces may reuse in future work.

`today-primary-action.ts` gains an optional exclusion parameter so a candidate Matchday already represents can be skipped without reranking the remaining decisions.

The existing golden visual-regression baseline (`today-primary-chromium-linux.png`) becomes stale by design (§4.7's one-match rule now also excludes an anchor-owned Live Now match from the lower timeline) and needs a human-approved rebaseline; this is tracked as a follow-up in the delivering PR rather than performed unilaterally by this change.

## Relationship

Extends ADR-0141 (Today as an operational command surface) with a new pre-live matchday phase model.

Extends ADR-0142 (composition ownership) by making Matchday a conditional occupant of the existing Live Now anchor position, without altering ADR-0142's five-item primary information architecture or ordering.

Does not change canonical plan-integrity rules, selection mutation rules, or live-reporting start/stop architecture — Matchday only surfaces and links to those existing systems.
