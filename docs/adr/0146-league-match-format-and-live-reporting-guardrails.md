# ADR-0146: League match-format domain and Live Reporting guardrails

## Status

Accepted (programme — delivered incrementally, following ADR-0133's precedent; see "Delivery" below)

## Context

League matches have no configurable match format today. `src/lib/live-match/period-config.ts`'s
`LEAGUE_PERIOD_CONFIG`/`REGULATION_ONLY_PERIOD_CONFIG` hardcode every League match to 25-minute
halves (plus fixed 10-minute extra-time halves for `CUP` matches) — `LeagueSeason` and `Team`
have no format fields at all, and `Match.matchDurationMinutes` (nullable, unset by any UI today)
only caps an evidence interval, it is never read by the live clock. Event matches, by contrast,
already have a real configurable format (`Event.numberOfHalves`/`matchDurationMinutes`/
`breakDurationMinutes`, with a per-`EventSquad` complete override — `event-types.ts`'s
`getEffectiveEventSquad*` resolvers, `period-config.ts`'s `getEventPeriodConfig`) — League has
never had the equivalent.

Separately, Live Reporting has no absolute safety limit. ADR-0133 (2026-09-09 incident) hardened
correctness and realtime durability — persisted clock (H2), `matchSeconds` unit fix (H3), score
reconciliation (H6a), keepalive (H6b) — but explicitly did not add a stale-session fail-safe. A
`LiveMatchSession` left active (a coach forgets to press "Finish live reporting", a device is
lost, a match is abandoned) stays `ACTIVE` indefinitely; nothing ever closes it server-side. The
only existing signal is advisory: `staleLiveSessionsToCandidates()`
(`src/lib/situational/providers/live-session-candidate-provider.ts`) surfaces a coach-facing
nudge after 10 minutes of no heartbeat — it mutates nothing.

Compounding this, League player/position minutes have no real bound today. League has no
`minutesPlayed` field at all (`PostMatchPlayerActual` carries no duration; confirmed by
`src/lib/insights/opportunity-quality.ts`'s own comment that realised minutes are untracked for
League). `rebuildActualTimeline()` (`src/lib/evidence/actual-timeline.ts`) caps the final
open-ended `ActualPositionInterval` at `Match.matchDurationMinutes` — a field no UI sets, so in
practice the cap is usually absent. A period left running because a coach forgot to end it would
today produce an unbounded open interval, exactly the "four hours of player minutes" failure mode
this ADR exists to close.

This ADR implements the "Matchboard Live Reporting Guardrails and Match Format" bundle
(`.matchboard-work/matchboard-live-reporting-guardrails-implementation-bundle/`, gitignored
working documents — decisions and formulas normatively sourced from there; not linked further
since the directory is not part of the durable repository). It is the direct successor to
ADR-0133: that ADR made a live session's data durable and correct; this one bounds how long a
session may run and what an abandoned running period is allowed to cost in player minutes, and
gives League the same configurable-format foundation Event already has.

## Decision

### 1. Shared match-format domain

One domain type, generalized from Event's existing model rather than duplicated for League
(bundle §02.8, AGENTS.md "one owning implementation"):

```ts
// src/lib/live-match/match-format.ts
export interface MatchFormatDefinition {
  numberOfPeriods: number;          // 1 | 2 — see "Adaptation" below
  periodDurationMinutes: number;
  breakDurationMinutes: number;
}
```

`src/lib/live-match/period-config.ts`'s `getEventPeriodConfig(matchDurationMinutes,
numberOfHalves, breakDurationMinutes)` generalizes to `buildPeriodConfigFromFormat(format:
MatchFormatDefinition)`; `getEventPeriodConfig` becomes a one-line adapter over it so no existing
Event caller changes. League gains the same builder instead of a second implementation.

**League configuration hierarchy** (complete-definition precedence, no field-by-field merge):

```text
Match.numberOfPeriodsOverride/periodDurationMinutesOverride/breakDurationMinutesOverride
    ↓ if any is null (a Match override is complete or absent, never partial)
Team.numberOfPeriodsOverride/periodDurationMinutesOverride/breakDurationMinutesOverride
    ↓ if any is null
LeagueSeason.defaultNumberOfPeriods/defaultPeriodDurationMinutes/defaultBreakDurationMinutes
    ↓ if any is null
unconfigured (null) — a legacy season, or one never configured
```

`resolveLeagueMatchFormat({ season, team, match })` in `match-format.ts` implements this;
`resolveEventMatchFormat(event, squad)` wraps the existing `getEffectiveEventSquadMatchTiming`
into the same `MatchFormatDefinition` shape (Event's own override fields/resolvers are
unchanged — this is an adapter, not a replacement, per the bundle's explicit "retain all current
Event-specific configuration behavior outside these three timing values").

**Legacy fallback stays byte-identical to today.** When `resolveLeagueMatchFormat` returns
`null` (no Season/Team/Match format configured anywhere — every League season today), the live
clock keeps using exactly the existing hardcoded `LEAGUE_PERIOD_CONFIG`/
`REGULATION_ONLY_PERIOD_CONFIG` (25-minute halves). A configured format is required going forward
only for *newly created* League seasons (bundle §02.3); no existing season's live behavior
changes until a coach explicitly configures one. `CUP` extra-time periods
(`EXTRA_FIRST_HALF`/`EXTRA_HALF_TIME`/`EXTRA_SECOND_HALF`, fixed 10-minute halves) are untouched
either way — they are a knockout mechanic outside this domain's three timing values, not part of
"intended match format."

**Freeze point.** The effective format resolves and snapshots once, at the same server transition
that establishes the actual Live Reporting start (`startLiveSession`/`startEventLiveSession`),
onto `LiveMatchSession`/`EventLiveMatchSession`: `formatNumberOfPeriods`,
`formatPeriodDurationMinutes`, `formatBreakDurationMinutes`, `formatSource`
(`SEASON`/`TEAM`/`MATCH`/`EVENT`, diagnostic only), `formatSnapshotAt`. A later Season/Team format
change never reinterprets an already-live or completed match; a not-yet-live match always
resolves current configuration at its own future start.

### 2. Actual Live Reporting start — reuse, don't reinvent

`LiveMatchSession.startedAt` (`@default(now())`, written once at session creation, never updated
by `endLiveSession`/`persistLiveSessionClock`/`heartbeatSession`) already has exactly the required
`liveReportingStartedAt` semantics — set once, server-side, persists across reloads, never derived
from `Match.startsAt`. `EventLiveMatchSession.startedAt` is identical. **No new column is added
for this.** Every timing formula below (240m warning, 270m auto-finish, contextual warning) reads
this field, never `Match.startsAt`/`EventMatch.startsAt`. This also means the migration concern in
the source bundle's §06.7.2 ("existing active sessions need a fresh start timestamp") does not
apply here — every currently-`ACTIVE` session already has a real `startedAt`; there is nothing to
backfill.

### 3. Guardrail constants and formulas

One module, `src/lib/live-match/live-reporting-guardrails.ts` — both League and Event read it;
no per-domain duplicate of any threshold:

```text
LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES = 180   // only when no format snapshot
LIVE_REPORTING_STRONG_WARNING_MINUTES        = 240
LIVE_REPORTING_AUTO_FINISH_MINUTES           = 270
LEGACY_ACTIVE_PERIOD_RECOVERY_CEILING_MINUTES = 60   // no format snapshot

periodOverrunAllowanceMs(periodDurationMinutes)   = max(10min, 25% of periodDurationMinutes)
activePeriodRecoveryCeilingMs(periodDurationMinutes) = periodDurationMinutes + overrunAllowance
expectedWallClockDurationMs(format) = numberOfPeriods*periodDurationMinutes
                                       + max(numberOfPeriods-1, 0)*breakDurationMinutes
matchOverrunAllowanceMs(expected)   = max(30min, 50% of expected)
contextualMatchWarningAtMs(format)  = expectedWallClockDurationMs(format) + matchOverrunAllowanceMs
```

All anchored to `startedAt` (§2), never to scheduled kickoff. Configured period duration never
automatically ends a period; an explicit `End Period` always preserves its actual elapsed
duration, uncapped — the ceiling above applies *only* when `finishLiveReporting` (§5) must resolve
a period still active at completion time.

### 4. Resolved period timing — new shared model

Neither League nor Event persists a per-period duration today (the clock's *current* period is
persisted; a completed period's actual length is implicit in `LiveMatchEvent`/`MatchRotation`
timestamps, or nowhere at all for a period abandoned mid-run). A new model, generalized across
League/Event via the same nullable-dual-FK + discriminator convention ADR-0104 established
(`matchId?`/`eventMatchId?`, hand-added `CHECK` constraint for exactly-one):

```prisma
model MatchPeriodTimingResolution {
  id                 String                 @id @default(cuid())
  organisationId     String
  matchId            String?
  eventMatchId       String?
  period             MatchPeriod
  rawElapsedMs       Int?
  resolvedDurationMs Int
  resolutionSource   TimingResolutionSource
  reviewStatus       TimingReviewStatus     @default(NOT_REQUIRED)
  reviewedAt         DateTime?
  reviewedBy         String?
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  @@unique([matchId, period])
  @@unique([eventMatchId, period])
}
enum TimingResolutionSource { EXPLICIT_PERIOD_END FINISH_LIVE_REPORTING RECOVERED_BOUNDED }
enum TimingReviewStatus { NOT_REQUIRED NEEDS_REVIEW REVIEWED }
```

One row per period that actually occurred, written when that period closes (explicit `End
Period`, or `finishLiveReporting` resolving a still-active one). This is the "resolved period
timeline" the rest of the system (player/position minutes, out-of-range event validation) reads —
never the raw persisted clock state directly, and never a hardcoded total. `rebuildActualTimeline`/
`rebuildEventActualTimeline` (`actual-timeline.ts`) are changed to cap each period's contribution
at its `MatchPeriodTimingResolution.resolvedDurationMs` instead of the current single static
`Match.matchDurationMinutes` end-cap (which is retained only as the final fallback when no
resolution row exists, e.g. a match reported through means other than Live Reporting).

### 5. One shared `finishLiveReporting` operation

Both today's manual completion path (`endLiveSessionAndCreateReportAction`/
`endEventLiveSessionAndCreateReportAction`) and the new automatic timeout path call one function,
built on the existing `FootballMatchRef` discriminated union (`src/lib/evidence/
football-match-ref.ts`, ADR-0104) rather than inventing a second League/Event split:

```ts
finishLiveReporting(ref: FootballMatchRef, trigger: "MANUAL" | "TIMEOUT", actor: ActorContext | SystemContext)
```

Sequence: load+lock session by compare-and-set (`status: "ACTIVE"` guard on the update —
Prisma-native optimistic concurrency, no raw SQL row lock) → if already non-`ACTIVE`, return the
existing result idempotently (the race loser observes completion, does not re-run it) → resolve
any still-active period (§6) → end the session (existing `endLiveSession`/`endEventLiveSession`,
unchanged) → seed/merge the post-match report (existing `seedReportFromLiveSession`/
`seedEventReportFromLiveSession`, unchanged — already merge-safe per ADR-0133 H1) → recompute the
resolved timeline (`rebuildActualTimeline`/`rebuildEventActualTimeline`) → return one result
shape regardless of trigger. `trigger` is retained only as audit/log metadata on the operation
call, never as a stored business state — no `AUTO_CLOSED`/`TIMED_OUT` value is added to
`LiveSessionStatus` or `MatchReportStatus`.

### 6. Active-period recovery at finish

When `finishLiveReporting` finds a running period (`LiveMatchSession.clockRunning`), it computes
`rawResolvablePeriodElapsed` from the existing persisted clock fields (`clockElapsedBeforeMs` +
elapsed since `clockPeriodStartedAt` if running — the same arithmetic `getElapsedMs` already
performs, never client wall-clock state) and resolves it:

- format snapshot present: ceiling = `activePeriodRecoveryCeilingMs` (§3); raw ≤ ceiling → use raw,
  `resolutionSource: FINISH_LIVE_REPORTING`, `reviewStatus: NOT_REQUIRED`; raw > ceiling → use
  ceiling, `resolutionSource: RECOVERED_BOUNDED`, `reviewStatus: NEEDS_REVIEW`, `rawElapsedMs`
  preserved.
- no format snapshot: same shape against the 60-minute legacy ceiling (§3).

A `MatchPeriodTimingResolution` row is written either way. Manual and `TIMEOUT` triggers hit this
exact same code path — there is no timeout-specific recovery algorithm. An explicit coach `End
Period` before finish is unaffected by any of this — it already wrote its own resolution row at
`EXPLICIT_PERIOD_END` with the raw, uncapped elapsed duration when the period closed.

### 7. Server-side reconciliation

New route, `src/app/api/cron/live-reporting-reconciliation/route.ts`, mirroring
`src/app/api/cron/notification-outbox/route.ts` exactly — `CRON_SECRET` bearer-auth
(`getCronSecret()`), no new authentication mechanism. `vercel.json` gains a second cron entry,
`*/5 * * * *`. Eligibility query (both `LiveMatchSession` and `EventLiveMatchSession`):
`status = "ACTIVE" AND startedAt <= now() - 270 minutes` — `Match.startsAt`/`EventMatch.startsAt`
never appears in this query. Bounded batch (~100, matching `processOutboxBatch`'s existing
pattern), one `finishLiveReporting(ref, "TIMEOUT", systemContext)` call per eligible session,
independent try/catch per session so one failure does not block the rest and a failed session
stays `ACTIVE` (eligible again next run).

### 8. Post-match review and submission gate

A `MatchPeriodTimingResolution` row with `reviewStatus: NEEDS_REVIEW` surfaces in the post-match
report as a callout (current resolved duration, `Confirm`/`Edit duration`). A correction command
persists the coach-supplied duration, sets `reviewStatus: REVIEWED`, and triggers the same
`actual-timeline.ts` recompute finish already uses (deterministic, idempotent). Final report
submission is blocked while any period for that match/event-match is `NEEDS_REVIEW`, and
separately blocked while any recorded event's period-relative timestamp exceeds its period's
current `resolvedDurationMs` (validated, never auto-shifted or deleted — the coach corrects the
event through the existing event-editing workflow).

## Adaptation: `numberOfPeriods` range

The source bundle specifies `numberOfPeriods: 1..8` as a general validation bound (its own text
notes this is "not a claim about normal football formats"). Matchboard's live clock is not
period-count-agnostic: `MatchPeriod` is a fixed, closed Prisma enum (`BEFORE`, `FIRST_HALF`,
`HALF_TIME`, `SECOND_HALF`, `EXTRA_FIRST_HALF`, `EXTRA_HALF_TIME`, `EXTRA_SECOND_HALF`,
`FULL_TIME`), and every consumer of it — `match-clock.ts`'s `advancePeriod` (walks a fixed ordered
list of these exact enum keys), the persisted `LiveMatchSession.clockPeriod` column, the
Cloudflare Durable Object worker's own protocol/state machine (`workers/live-match/`, a separately
deployed system with independent release cadence), and every UI period label — assumes this same
closed set. Regulation play has at most two enum slots (`FIRST_HALF`/`SECOND_HALF`); the other two
playing slots are named and reserved for extra time, not generic "period 3/4."

Genuinely supporting an arbitrary period count (e.g. 4 quarters) would mean redesigning the shared
period representation across the Prisma schema, the live-clock domain, and the Worker's protocol —
an architecturally-significant change in its own right, out of proportion to a guardrails/format
bundle and appropriately scoped as its own future ADR if Matchboard ever needs quarter-based or
other >2-period formats.

**Adaptation applied**: `numberOfPeriods` is validated to `{1, 2}` — exactly what Event's existing
`numberOfHalves` already supports and what the current clock/Worker model can represent.
`numberOfPeriods: 1` produces today's single continuous "Match" period shape;
`numberOfPeriods: 2` produces today's First half/Half time/Second half shape. Every other
invariant in the source bundle (precedence, freeze point, timing authority, recovery ceilings,
shared finish operation, review gate, 240/270-minute absolute limits) is implemented exactly as
specified — only this one outer numeric range narrows, per the bundle's own "smallest
implementation adaptation that preserves every behavioral invariant" allowance
(`AGENT-PROMPT.md`'s closing clause). `intendedPeriodDuration`/`intendedBreakDuration` validation
bounds (`>0, ≤120min` / `≥0, ≤60min`) are otherwise implemented as specified.

## Alternatives considered

- **Redesign `MatchPeriod` to an open-ended integer period index**, to support the full 1..8
  range as specified. Rejected for this change: ripples into the Cloudflare Worker's protocol
  (a coordinated cross-repo deploy, ADR-0086/0138 territory), every existing clock/UI consumer,
  and the whole live-realtime test suite, for a capability (>2-period League/Event formats) no
  current product requirement asks for. Revisit only if a real format need arises.
  - This surfaces immediately: `EXTRA_FIRST_HALF`/`EXTRA_SECOND_HALF` are two *specifically-named*
    extra-time slots (10-minute fixed halves, `CUP`-only), not generic "period 3/4" — reusing them
    as generic periods would silently conflate extra time with a 3rd/4th regular period, which is
    worse than the narrower `{1,2}` range this ADR adopts instead.
- **A new `liveReportingStartedAt` column on `Match`/`EventMatch`.** Rejected: `LiveMatchSession.
  startedAt`/`EventLiveMatchSession.startedAt` already have the exact required semantics (§2);
  adding a second field would create two sources of truth for the same instant, and would need
  its own backfill for every currently-active session for no behavioral gain.
- **A single polymorphic League+Event finish/format module instead of `FootballMatchRef`
  adapters.** Rejected: reuses the abstraction ADR-0104 already built and validated for exactly
  this League/Event-parity problem, rather than inventing a second one.
- **Per-tick clock persistence instead of the existing transition-only persistence for computing
  `rawResolvablePeriodElapsed`.** Rejected: ADR-0133 H2's existing `clockElapsedBeforeMs` +
  `clockPeriodStartedAt` model already reconstructs elapsed time at any later instant without a
  per-second write; `finishLiveReporting` reads it the same way any reload does.

## Consequences

- League gains real, configurable match format for the first time; every existing League season
  remains on today's hardcoded 25-minute-halves behavior until a coach explicitly configures one,
  and every newly created season must configure one (application-level validation, not a DB
  `NOT NULL` — legacy seasons must be able to stay unconfigured indefinitely).
- `period-config.ts`'s Event-only period builder becomes the shared builder both domains call;
  `getEventPeriodConfig` keeps its name/signature as a thin wrapper, so no existing Event call site
  changes.
- `actual-timeline.ts`'s end-of-match cap moves from a single static `Match.matchDurationMinutes`
  value to per-period `MatchPeriodTimingResolution.resolvedDurationMs` rows — a real fix, since the
  static field is unset by any UI today and was never a per-period bound in the first place.
  League still has no stored `minutesPlayed` field after this ADR (unchanged scope — only the
  *interval* data these rows already feed into is now correctly bounded); adding a stored
  League `minutesPlayed` column is a separate future decision if a product need for it arises.
- No `AUTO_CLOSED`/`TIMED_OUT` lifecycle state is introduced; `TIMEOUT` is call-site/audit metadata
  only, matching the bundle's explicit D12 decision.
- A new Vercel Cron job runs every 5 minutes; this is the second cron route the project has ever
  had (`notification-outbox` is the first), following its exact auth pattern.
- Schema changes follow ADR-0105 expand/contract: every new column is nullable/optional, every new
  model is purely additive, and no PR in this programme requires the two-PR split — see Delivery.

## Migration

- `LeagueSeason.defaultNumberOfPeriods`/`defaultPeriodDurationMinutes`/`defaultBreakDurationMinutes`
  (nullable): existing seasons stay `null`; never inferred from age, scheduled duration, or
  football-domain knowledge (bundle §06.3).
- `Team.numberOfPeriodsOverride`/`periodDurationMinutesOverride`/`breakDurationMinutesOverride`
  (nullable): existing teams stay `null` (inherit), no override created by migration.
- `Match.numberOfPeriodsOverride`/`periodDurationMinutesOverride`/`breakDurationMinutesOverride`
  (nullable): existing/future matches stay `null` until Live Reporting starts and freezes
  whatever was resolvable at that moment — never snapshotted retroactively by migration.
- `LiveMatchSession`/`EventLiveMatchSession` gain `formatNumberOfPeriods`/
  `formatPeriodDurationMinutes`/`formatBreakDurationMinutes`/`formatSource`/`formatSnapshotAt`
  (all nullable): every existing session (`ACTIVE` or `ENDED`) stays unsnapshotted — per bundle
  §06.7.4, a legacy already-live session's format is never resolved retroactively after the fact.
  `startedAt` needs no migration (§2).
- New `MatchPeriodTimingResolution` model, additive only, empty until the first period closes
  under the new code path. No existing `LiveMatchEvent`/`MatchRotation` row is read, rewritten, or
  backfilled by this migration.
- No existing running period is closed or clamped by the migration itself (bundle §06.8) — the
  next manual or `TIMEOUT` `finishLiveReporting` normalizes it under §6's rules, same as any
  period that started after this migration.

## Supersedes

None. Extends ADR-0133 (durability/correctness hardening this ADR adds a hard TTL and format
domain on top of), reuses ADR-0104's `FootballMatchRef`/adapter pattern and ADR-0105's
expand/contract discipline, and generalizes the Event format model `event-types.ts`/
`period-config.ts` already established rather than replacing it.

## Delivery

Delivered incrementally, each slice its own branch/PR/merge before the next starts (this
repository's sequential-PR policy), mirroring ADR-0133's own delivery shape:

1. Schema (expand-only) + shared `match-format.ts`/`live-reporting-guardrails.ts` domain modules +
   League Season/Team/Match format configuration UI. No live-clock/finish behavior changes yet.
2. Freeze-at-start snapshotting + format-driven `PeriodConfig` for configured League matches
   (legacy/unconfigured unchanged) + period-overrun/contextual/legacy/strong-warning UI in Live
   Reporting and read-only Follow Live.
3. `MatchPeriodTimingResolution` + centralized `finishLiveReporting`/active-period recovery +
   `actual-timeline.ts` resolved-timeline recompute + concurrency/idempotency.
4. Server-side reconciliation cron (270-minute `TIMEOUT`).
5. Post-match recovered-timing review/correction UI + submission gate + out-of-range event
   validation.
6. Documentation sweep + full test-plan closure against the acceptance checklist.

## History

### 2026-09-17

Record created ahead of implementation, following investigation of the current League/Event
match-format and Live Reporting completion code (no configurable League format; no absolute
Live Reporting TTL; League player minutes structurally unbounded for an abandoned running
period).
