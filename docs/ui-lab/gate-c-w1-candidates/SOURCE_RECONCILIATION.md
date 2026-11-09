# Gate C W1 — Source Reconciliation

## What the authoritative bundle actually contains for Gate C

The handoff bundle
(`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/`)
has no Gate-C wave-ordering document. `20_UI_LAB_CANDIDATE_WAVES.md` in that directory is
explicitly a **Gate A** wave plan (W0-W5, A01-A12 only) — it says nothing about Gate C wave
scope or ordering. No `20_...`-style Gate C equivalent exists anywhere under `.matchboard-work`.

The only Gate-C-specific source is `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`'s eight rows, verbatim:

| golden_id | family | design_surface | required_state | required_viewports_or_themes | primary_acceptance_question | status | direction_status | official_golden_status |
|---|---|---|---|---|---|---|---|---|
| C01 | Today | Quiet day | One relevant football object | Desktop dark + mobile light | Bounded immediate chronology and calm next relevant object, not second League schedule; demonstrable improvement (XR-T01 XR-S02 XR-V01) | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C02 | Today | Decision day | One primary/2 secondary | Desktop dark + mobile dark | Priority tied to actual situation, sources disclosed | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C03 | Today | Matchday or live | Before kickoff/live | Desktop light + mobile dark | Identify next match/action in busy same-day chronology; current state distinguishable; preserve temporal context (XR-T01 XR-V02) | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C04 | Round Board | Planning open | Unresolved player decision | Desktop dark + mobile dark | Opportunity distribution with eligible denominator near actionable round work (XR-A02) | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C05 | Round Board | Planning closed | Unresolved historical warnings | Desktop dark + mobile light | Read-only meaning, no false Resolve action | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C06 | Round Board | Allocation | Dense matrix | Desktop light + mobile assigned sheet | Match assignment retains 24-slot precision while player summaries/inspectors use 14 general roles (XR-P02) | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C07 | Today | Assistant Coach context-free fallback | Decision day, capability OFF/ON | Desktop + mobile | Same priority/layout when OFF; only material contextual synthesis when ON | Needs golden | DIRECTIONAL_ONLY | NOT_READY |
| C08 | Round Board and Today | Same-day quick add | Planning open / after RSVP / closed / guest / late arrival | Mobile + desktop | No route labyrinth; permission-specific action, accurate consequence | Needs golden | DIRECTIONAL_ONLY | NOT_READY |

Every row is `DIRECTIONAL_ONLY` / `NOT_READY` — none of C01-C08 is an approved golden, and none
carries a wave assignment.

## Consequence for this wave's scope

**This wave's scope (C01-C03) is self-assigned and provisional**, not drawn from an authoritative
wave document — per the handoff brief's own fallback instruction ("If the original register is
unavailable, proceed with a clearly marked provisional Today candidate wave... Document the
missing authority and do not claim full official-register compliance"). This document is that
disclosure. Nothing in this wave claims `official_golden_status: APPROVED` or implies an
authoritative wave order exists; `candidate_manifest.json` keeps every entry's `status` as
`CANDIDATE`.

## Scope decision

- **In scope:** C01 (Today, quiet day), C02 (Today, decision day), C03 (Today, matchday
  pre-live — PREPARE/VERIFY/IMMINENT, League and Event). These three rows are exactly the brief's
  own default first-wave scope (§3) and are entirely Today-owned.
- **Out of scope, deferred (see `BLOCKERS.md`):**
  - **C07** — requires wiring Assistant Coach contextual synthesis into Today for the first
    time. `CURRENT_STATE_AUDIT.md` confirms zero such wiring exists in Today today; building it
    is a new capability, which the brief's §12 explicitly forbids for this wave ("Add a new AI
    recommendation engine", "Introduce a second Today composition owner").
  - **C04-C06** — Round Board's own register rows.
  - **C08** — jointly owned by Round Board and Today; the brief explicitly instructs not to
    start Round Board's Gate C wave here, and nothing in the bundle contradicts that.

## Referenced ADRs

ADR-0124 (adaptive contextual composition), ADR-0134-0136 (Touchline visual identity/Atlas),
ADR-0141 (Today operational command surface), ADR-0142 (Today composition ownership), ADR-0143
(Matchday pre-live composition and dedup), ADR-0157 (contextual coach workspace convergence),
ADR-0159 + its PR #825 amendment (Visual Authority governance, scenario-scoped comment ledger).
None of these are reopened by this wave — their decisions are the baseline this wave confirms
against (see `CURRENT_STATE_AUDIT.md`).
