# ARR-0053: Planned-rotation change timing uses a flat absolute-seconds field, unreconciled with live reporting's period-relative match-time model

## State

Confirmed

## Identified

2026-09-24

## Residue

Matchboard has two live, un-reconciled representations of "when, in a match, something
happens":

1. **Live reporting's model** (`src/lib/live-match/`): match time is period-relative.
   `LiveMatchEvent.matchSeconds` (`MatchClockState`, `live-match-types.ts`) is milliseconds
   since the start of the *current* period — it resets to 0 at the start of `SECOND_HALF`,
   `EXTRA_FIRST_HALF`, etc. `MATCH_PERIOD_ORDER` (`live-match-types.ts:144-153`) is a real,
   first-class enum including `HALF_TIME`/`EXTRA_HALF_TIME` as addressable periods, not just
   in-play ones — a substitution genuinely recorded while the clock sits paused at `HALF_TIME`,
   before `SECOND_HALF`'s `PERIOD_START`, is representable and distinguishable from one tagged
   `FIRST_HALF` or `SECOND_HALF`. `getCumulativePeriodOffsetsMs`/`toAbsoluteMatchMs`
   (`period-config.ts:163-187`) exist specifically to convert a period-relative reading into one
   true absolute-since-kickoff value when that's needed.

2. **Planned-rotation's model** (`src/lib/planned-rotation/`): `PlannedRotationChangeData`
   (`planned-rotation.ts:7-15`) has no period field at all — `approximateMatchSeconds` is a
   single coach-entered `number | null`, a flat "seconds since kickoff" value spanning the
   *entire* match as one continuous number line. `projectPlannedLineup` (`planned-rotation.ts:
   351-405`) and `buildPlannedScenarioIntervals` (`scenario-evaluation.ts:104-138`) both consume
   this raw number directly — no period parameter, no period-boundary lookup anywhere in either
   function. This is a deliberate, documented design choice, not an oversight: ADR-0115 (lines
   59-62, 85-86) explicitly chooses "one flat match-clock value... no period-offset conversion
   needed" over adopting live reporting's existing model.

The UI reflects representation 2 only: the planned-rotation form (`planned-rotation-panel.tsx:
286-297`) is a bare numeric-minutes text input ("Approx. minute") — no period selector, no
half-time option, nothing acknowledging that a match has a gap between two halves at all.
Because representation 2 treats the whole match as one continuous number line, "30:00" in a
30-minute-half match is simultaneously "the instant the first half ends" and "the instant the
second half begins" — there is no distinct value a coach can enter that means "during the break
itself," only a number that happens to coincide with a boundary. `projectPlannedLineup`'s
`c.approximateMatchSeconds <= atSeconds` comparison (line 370) resolves ties deterministically
(a boundary-exact value is treated as already-applied, leaning toward "start of second half"
semantics) — but this is an incidental property of the comparison operator, never a declared
intent.

The two representations meet, unconverted, when a plan is applied live:
`applyPlannedChangeAction` (`planned-rotation-live-actions.ts:91-93`) reads
`estimateCurrentMatchOffsetMs()` — documented as period-relative milliseconds (ADR-0133 H3) —
and stores it directly as `actualMatchSeconds`, asserting (line 38-40) this is "like-for-like
with `approximateMatchSeconds`." It is not: one is period-relative, the other is absolute.

## Intended architecture

Live reporting's period + period-relative-offset model, with explicit conversion to an absolute
value via `toAbsoluteMatchMs`/`getCumulativePeriodOffsetsMs` wherever an absolute comparison is
genuinely needed, is the established pattern for representing "when in a match" in this
codebase. Planned-rotation's flat absolute-seconds field is a second, independently-invented
representation of the same domain concept, never reconciled with the first. Which
representation planning should ultimately use (adopt live reporting's period model directly,
keep the flat value for in-play entry but add an explicit period-boundary marker, or another
resolution) is not decided here — see "Disposition."

## Evidence

- `src/lib/planned-rotation/planned-rotation.ts:7-15` — `PlannedRotationChangeData`, no period
  field.
- `src/lib/planned-rotation/planned-rotation.ts:351-405` — `projectPlannedLineup`, raw
  `atSeconds` parameter, no period awareness; line 370's `<=` boundary comparison.
- `src/lib/planned-rotation/scenario-evaluation.ts:37-40` — module comment explicitly asserting
  "no period-offset conversion is needed here."
- `src/components/matches/planned-rotation-panel.tsx:286-297` — the bare numeric-minutes input,
  no period selector.
- `docs/adr/0115-reactive-pre-match-scenario-evaluation.md:59-62,85-86` — the deliberate,
  documented choice of a flat absolute value over period-aware conversion.
- `src/lib/live-match/live-match-types.ts:144-153` — `MATCH_PERIOD_ORDER`, including `HALF_TIME`
  as a first-class, addressable period.
- `src/lib/live-match/period-config.ts:163-187` — `getCumulativePeriodOffsetsMs`/
  `toAbsoluteMatchMs`, the existing, unused-by-planning conversion helpers.
- `src/app/(app)/matches/planned-rotation-live-actions.ts:38-40,91-93` — the unconverted
  `actualMatchSeconds` assignment and its "like-for-like" claim.
- `src/lib/live-match/live-match-event-store.ts:329-343` — `estimateCurrentMatchOffsetMs`,
  documented as period-relative milliseconds.
- `src/lib/planned-rotation/rotation-vs-actual.ts:92-97` — the naive
  `actualMatchSeconds - approximateMatchSeconds` subtraction that consumes the mismatch.
- `docs/adr/0097-planned-rotation-live-execution.md:31` — the "applied N min later/earlier than
  planned" deviation-note feature this bug corrupts.
- `src/app/(app)/matches/planned-rotation-actions.ts:304-306,511-513` and
  `src/app/(app)/matches/integrated-match-plan-actions.ts:297-298` — `totalMatchSeconds` for
  planning sourced from the hardcoded `getLeaguePeriodConfig` (fixed 25-minute halves,
  `period-config.ts:14-33`), never the format-aware `getLeagueMatchPeriodConfig` that would
  reflect a match's actually configured half length — a second, compounding symptom of planning
  never adopting the shared period-config machinery live reporting already uses correctly.

## Impact

- **Confirmed, reproducible defect**: for any plan change applied during or after the second
  half, `rotation-vs-actual.ts`'s deviation note reports a fabricated "applied N minutes
  early/late" figure. Worked example: a change planned for "minute 40" of a 2×30 match
  (`approximateMatchSeconds = 2400`) applied 10 real minutes into the second half
  (`actualMatchSeconds ≈ 600`, period-relative) yields `deviationSeconds = 600 - 2400 = -1800` →
  "Applied 30 min earlier than planned," when it was in fact applied on time. This directly
  misleads a coach about their own plan adherence.
- **Confirmed, separate defect**: planning's coverage/total-duration math always assumes 25-
  minute halves regardless of a match's actually configured format, producing wrong totals for
  any match not on that exact configuration (e.g. the 30-minute-half case that surfaced this
  ARR).
- **Conceptual gap, not yet a defect but user-visible friction**: a coach cannot express "this
  substitution happens during the half-time break" at all — only a number that happens to land
  on a period boundary, whose tie-breaking behavior is an implementation accident, not a
  declared UX.
- This is architectural residue, not an ordinary bug, because the two representations are each
  internally consistent and independently correct within their own subsystem — the defects only
  appear at the boundary where planning's output (`approximateMatchSeconds`) and live
  reporting's output (`actualMatchSeconds`) are compared without conversion. Fixing the
  `rotation-vs-actual.ts` symptom alone (e.g. by converting `actualMatchSeconds` through
  `toAbsoluteMatchMs` before subtracting) would resolve the confirmed bug but leave the
  underlying duality — and the half-time UX gap — in place for the next feature that touches
  either side.

## Containment

- Do not add a new call site that compares `approximateMatchSeconds` (planning, absolute) and
  `actualMatchSeconds`/any live period-relative reading (`estimateCurrentMatchOffsetMs`,
  `LiveMatchEvent.matchSeconds`, `MatchClockState`) without an explicit conversion through
  `toAbsoluteMatchMs`/`getCumulativePeriodOffsetsMs`.
- Do not add a second, independent "half-time" concept to planning (e.g. a bespoke boolean flag)
  without first checking whether adopting live reporting's existing `MatchPeriod`/`HALF_TIME`
  model directly would serve the same need — see "Intended architecture."
- Do not extend `checkPlannedRotationCoverage` or any other planning total-duration computation
  to a new call site without first switching it onto the format-aware
  `getLeagueMatchPeriodConfig`, rather than propagating the hardcoded 25-minute-half config
  further.

## Resolution criteria

- Planning and live reporting share one unambiguous representation of "when in the match,"
  either by planning adopting the period + period-relative-offset model directly, or by an
  explicit, tested conversion layer at every point the two are compared — decided via ADR, not
  invented ad hoc at a call site.
- `rotation-vs-actual.ts`'s deviation note produces correct values for a plan change applied in
  any period, including the second half and any extra-time period, with a regression test
  covering at least one cross-period case (the worked example above).
- Planning's `totalMatchSeconds`/coverage computation reflects the match's actually configured
  period durations (via `getLeagueMatchPeriodConfig`), not the hardcoded default.
- A coach has some way to express "this change happens at/during the half-time break" that is
  not merely a numeric coincidence with a period boundary — the specific mechanism is a decision
  this ARR does not make (see "Disposition").

## Disposition

Pending. No ADR yet decides which resolution path planning should take (adopt the period model
directly vs. an explicit conversion layer vs. another approach) — the deviation-note bug and the
hardcoded-duration bug are independently fixable now without that larger decision (each is a
local, well-understood defect with existing conversion/config helpers available), but doing so
does not resolve this ARR, only its two confirmed symptoms.

## Related decisions

- ADR-0115 (`docs/adr/0115-reactive-pre-match-scenario-evaluation.md`) — the decision that
  introduced planning's flat-absolute-seconds model.
- ADR-0097 (`docs/adr/0097-planned-rotation-live-execution.md`) — Apply/Delay/Skip/Change
  semantics and the deviation-note feature this residue corrupts.
- ADR-0133 (live match clock, H3) — the period-relative `matchSeconds` convention this residue
  diverges from.
- ADR-0146 — guardrails/format override, source of the format-aware period config planning does
  not currently use.

## Related implementation

- GitHub issue [#674](https://github.com/lagebj/matchboard/issues/674) — a related but distinct
  planned-rotation UX gap (player-list scoping, position-field exposure), filed the same day.
  Not the same residue: #674 is about what the coach sees on the form; this ARR is about the
  underlying time representation both the form and the live-execution bridge build on.

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-24

Record created. Prompted by a user question about how to declare a half-time substitution for a
30-minute-half match ("at 30m — is that ambiguous?"). Investigated and confirmed: the exact
boundary case is not actually ambiguous in current behavior (deterministic `<=` tie-breaking),
but the underlying flat-absolute-seconds model has no way to express "during the break" at all,
and the same duality independently causes two confirmed, reproducible defects (the
`rotation-vs-actual.ts` deviation-note miscalculation for any second-half-or-later applied
change, and a hardcoded-25-minute-half total-duration computation that never reflects a match's
actual configured format).
