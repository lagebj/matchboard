# ARR-0046: League/Event live-coordination asymmetry

## State

Dispositioned

## Identified

2026-09-12

## Residue

`AGENTS.md`'s "Live match realtime session files" section documents League and Event live
reporting as sharing one behavioural contract, and ADR-0112 states "League and Event behavior
must be equivalent" as a design goal. A direct audit of `event-live-match-client.tsx` and
`event-live-actions.ts` (2026-09-12, against `main`@`f6cd772a`) found this is not currently true
in a specific, verifiable way: **Event live reporting has zero Cloudflare Durable Object
involvement.**

`createEventActions.recordEvent` (`event-live-match-client.tsx`) calls
`recordEventLiveEventAction` (`src/app/(app)/events/[eventId]/event-live-actions.ts:98`)
unconditionally — plain HTTP to `recordEventEvent()`
(`src/lib/live-match/event-live-match-event-store.ts:23`), which writes directly to
`db.eventLiveMatchEvent.create(...)`. There is no `useLiveRealtime`/`RealtimeMatchClient` import
anywhere in the Event live client file, no `persistClock`, and no `onLiveUpdate`/
`reconnectRealtime` entries on the returned `LiveMatchActions` object — all of which
`createLeagueActions` has. Event also has no persisted live-session clock fields at all
(`EventLiveMatchSession` carries no `clockPeriod`/`clockRunning`/`clockPeriodStartedAt`/
`clockElapsedBeforeMs`-equivalent columns, unlike `LiveMatchSession`, which gained these under
ADR-0133 H2).

This is a stronger asymmetry than the programme's own preparatory notes assumed ("League and
Event are not fully equivalent in all persistence and clock details") — Event does not
participate in Durable Object coordination at all, so it has no shared-view consistency with a
second connected device, no realtime keepalive/dead-link detection (ADR-0133), and no persisted
clock recovery on reload, none of which Event coaches currently get even though League coaches
do.

## Intended architecture

ADR-0138 (Decision, point 1) requires League and Event to share one behavioural contract:
protocol, operation classification, sequence semantics, projection behaviour, offline queue
behaviour, conflict behaviour, sync indicators, and Follow Live semantics — while permitting
separate Prisma tables/adapters where that remains simpler. Event must gain real Durable Object
coordination (its own `MatchSessionObject`-coordinated session, or the same one generalized to
accept an Event-match subject type) rather than remaining a plain-HTTP-only adapter.

## Evidence

- `src/components/live-match/event-live-match-client.tsx` — `createEventActions.recordEvent`
  (lines ~46-55), no realtime client wiring anywhere in the file.
- `src/components/live-match/league-live-match-client.tsx` — the equivalent League adapter, for
  contrast: realtime-first `recordEvent`, `useLiveRealtime`, `persistClock`, `onLiveUpdate`,
  `reconnectRealtime`.
- `prisma/schema.prisma` — `LiveMatchSession` (League, has clock columns) vs.
  `EventLiveMatchSession` (Event, no clock columns).
- `src/lib/live-match/event-live-match-event-store.ts:47` — `db.eventLiveMatchEvent.create(...)`,
  the sole persistence path for Event live events, with no coordinator step ahead of it.

## Impact

- An Event match's live reporting has no shared-device convergence guarantee: a second coach
  opening the same Event match session sees only whatever the 5-second poll (`getRecentEvents`)
  happens to have fetched, not a realtime broadcast.
- Event gets none of ADR-0133's Durable-Object-dependent hardening (keepalive/dead-link
  detection, persisted clock recovery on reload) — an Event coach reloading mid-match can still
  lose clock continuity in a way a League coach cannot.
- Any implementation of this programme's protocol v2 / persisted sequence / domain-aware
  conflict model that only targets League would leave Event permanently on the older, weaker
  model, re-creating exactly the asymmetry ADR-0112 already named as undesirable.

## Containment

- Do not add new Event-specific live-reporting features that assume an eventual Durable Object
  path without first confirming this ARR's resolution status — building on top of the HTTP-only
  path risks doubling the migration surface later.
- Do not implement League-only fixes for the canonical-sequence/domain-precondition/outbox work
  in this programme without an explicit, documented reason Event is deferred to a later bundle —
  `TEST_MATRIX.md`'s own rule applies: "Any test that is not applicable must have an explicit
  domain reason. Do not silently skip because Event implementation lags."

## Resolution criteria

- [ ] Event live match sessions authenticate against and are coordinated by a Durable Object
      session, on the same protocol version as League.
- [ ] `EventLiveMatchSession` (or an equivalent) persists clock state with the same recovery
      guarantee `LiveMatchSession` already has (ADR-0133 H2).
- [ ] The full League contract-level test suite (classification, preconditions, sequence,
      outbox, conflict, Follow Live) is run against Event through its own adapter and passes, per
      `TEST_MATRIX.md` §12.
- [ ] Event's Follow Live equivalent (if any) converges to the same canonical projection Event's
      own reporter uses, matching League/ADR-0112's existing guarantee.

## Disposition

**Dispositioned.** ADR-0138 records the decision that League/Event must share one contract.
Implementation is scoped to Bundle 8 ("Conflicts/end/Event parity") of the Canonical Live
Operations & Delayed-Concurrency programme, after Bundles 2-5 establish the shared protocol,
concurrency, mutation-path, and projection model against League first — closing this gap earlier
than the shared model exists would mean building Event's coordination twice.

## Related decisions

- ADR-0138 (Canonical Live Operation Stream, Persisted Sequence, and Scoped Offline Continuation)
- ADR-0112 (Canonical live-match projection and per-PR Worker deployment) — already stated "League
  and Event behavior must be equivalent" as a goal; this ARR documents the concrete gap against
  that goal.
- ADR-0086 (Live match realtime coordination runs on Cloudflare Durable Objects) — the coordination
  model Event does not yet participate in.

## Related implementation

- `src/components/live-match/event-live-match-client.tsx`
- `src/app/(app)/events/[eventId]/event-live-actions.ts`
- `src/lib/live-match/event-live-match-event-store.ts`
- `src/lib/live-match/event-live-match-session.ts`
- `prisma/schema.prisma` (`EventLiveMatchSession`, `EventLiveMatchEvent`)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-12

Record created during Bundle 1 of the Canonical Live Operations & Delayed-Concurrency programme.
Confirmed via direct code audit that Event has zero Durable Object involvement, a stronger finding
than the programme brief's own preparatory assumption of partial parity.
