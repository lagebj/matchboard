# ARR-0045: Dual canonical live-event write path (Durable Object + direct HTTP)

## State

Resolved

## Identified

2026-09-12

## Residue

League live match reporting has two paths that can each independently persist a canonical
`LiveMatchEvent` row in Neon for the same logical coach action:

1. **Durable Object path**: `league-live-match-client.tsx`'s `createLeagueActions.recordEvent`
   calls `realtime.tryRecordEvent()` → `RealtimeMatchClient.recordEvent()` (WebSocket RPC) →
   `MatchSessionObject.handleRecordEvent` (`workers/live-match/src/match-session-object.ts`) →
   HMAC-signed `POST /api/internal/live-match/events` → `recordEventForActor()`
   (`src/lib/live-match/live-match-event-store.ts:39`) → `db.liveMatchEvent.create(...)`.
2. **Direct HTTP path**: the same `recordEvent` function falls through to
   `recordLiveEventAction()` (`src/app/(app)/matches/[matchId]/live/live-actions.ts:113`) →
   `recordEvent()` (`live-match-event-store.ts:127`) → the same `recordEventForActor()` — but
   reached directly from the browser, with no Durable Object involvement, whenever the realtime
   attempt is unavailable or its `persistenceStatus` is not `"persisted"`.

Both paths converge on one owning persistence function (`recordEventForActor()`), satisfying
"one owning implementation," and are deduplicated by the `clientEventId` unique constraint — so
this residue does not currently produce duplicate rows in the common case. What it does not
satisfy is "one command-sequencing authority": path 2 can create a canonical Neon row that the
Durable Object's own ordering (`version` counter, ADR-0086) never observed or ordered, and no
persisted field records which path, or in what true acceptance order relative to other devices'
actions, produced any given row.

A separate, now-confirmed-dead module, `src/lib/live-match/local/live-sync.ts`
(`recordEventLocallyFirst`), independently implements a third call into
`recordLiveEventAction` — but a repository-wide grep found no importer of any export from this
file. It is not currently reachable in production and is recorded here as containment context,
not as a third live write path.

## Intended architecture

ADR-0138 decides that after its migration cutover, the match's Durable Object coordinator is the
only normal path by which a *new* live operation is canonically ordered. When the coordinator is
unavailable, the browser keeps the command in its local durable outbox and retries — it does not
fall through to an independently-ordered direct Neon write. The existing HTTP server action
becomes reachable only as an adapter behind the coordinator's own persistence flow (the existing
signed internal endpoint), never as a caller-facing alternate canonical write surface.

## Evidence

- `src/components/live-match/league-live-match-client.tsx` — `createLeagueActions.recordEvent`
  (realtime-first, HTTP-fallback-on-non-persisted logic).
- `src/app/(app)/matches/[matchId]/live/live-actions.ts:113` — `recordLiveEventAction`, callable
  directly from the browser.
- `src/lib/live-match/live-match-event-store.ts:39,127` — `recordEventForActor()`/`recordEvent()`,
  the shared owning persistence implementation both paths reach.
- `src/app/api/internal/live-match/events/route.ts:44` — the internal endpoint the Durable Object
  path uses, also calling `recordEventForActor()`.
- `src/lib/live-match/local/live-sync.ts` — dead-code third instance of the direct-HTTP pattern;
  no importer found repository-wide (`recordEventLocallyFirst`, `syncAllUnsyncedEvents`,
  `cleanupAfterSessionEnd`).

## Impact

- No persisted canonical sequence can ever be constructed from existing `LiveMatchEvent` rows
  with full confidence about true multi-device acceptance order, since either path could have
  produced any given row.
- Fixing false conflicts (an unrelated goal invalidating a pending rotation) requires exactly one
  sequencing authority to evaluate preconditions against — a second, uncoordinated writer defeats
  that regardless of how carefully the coordinator's own precondition logic is built.
- The dead `live-sync.ts` module, if ever accidentally wired up again (e.g. copy-pasted as a
  starting point for new local-first code), would reintroduce a third uncoordinated writer.

## Containment

- Do not add a new call site of `recordLiveEventAction` (or the Event equivalent,
  `recordEventLiveEventAction`) from browser/client code. New live-operation writes must go
  through the realtime/coordinator client.
- Do not resurrect or import from `src/lib/live-match/local/live-sync.ts` without first
  reconciling it with the canonical operation model this ARR and ADR-0138 describe — it predates
  the durable outbox state machine and does not implement it.
- Do not add a fourth independent call path into `recordEventForActor()` for any reason short of
  the one coordinator-owned internal endpoint.

## Resolution criteria

- [x] The browser has exactly one caller-facing path for a new live operation: the
      realtime/coordinator client. A static/grep-based test proves no browser adapter calls
      `recordEventForActor()`-backed persistence directly outside the signed internal endpoint.
- [x] When the coordinator is unavailable, the command is retained in the local durable outbox and
      retried — verified by a test that a coordinator-unavailable scenario produces no direct Neon
      write.
- [x] `src/lib/live-match/local/live-sync.ts` is either removed (confirmed still unreachable) or
      rewritten to be the coordinator-first, outbox-backed implementation and reconnected as the
      one local-first entry point `live-match-client.tsx` uses instead of its own inline
      reimplementation.
- [x] Existing dual-path tests (League Stage 5/6 regression suite) are updated to assert the new
      single-path behaviour rather than the old fallback-to-HTTP behaviour.

All four resolution criteria are met for League. Event's own separate residue (zero coordinator
involvement at all, not a dual path) remains open as ARR-0046, unaffected by this resolution — see
that ARR's own disposition.

## Disposition

**Resolved (2026-09-13, Bundle 4).** `createLeagueActions.recordEvent`
(`league-live-match-client.tsx`) no longer falls through to an HTTP canonical write when the
realtime path is unavailable or its persistence is only `"pending"` — both cases return success
or a retryable failure purely based on the coordinator's own acceptance, never an independent
Neon write. `recordLiveEventAction` (the direct-HTTP server action) is deleted entirely, not
merely unused — it had no remaining legitimate caller once the fallback was removed.
`src/lib/live-match/local/live-sync.ts` (the confirmed-dead third instance of the same pattern)
is deleted. A new static test suite
(`src/lib/live-match/__tests__/single-mutation-path.test.ts`) proves, by direct source
inspection: `recordLiveEventAction` is no longer exported; `local/live-sync.ts` no longer exists;
`league-live-match-client.tsx` imports neither `recordLiveEventAction` nor `recordEventForActor`;
no `"use client"` component anywhere imports/calls `recordEventForActor`; and
`recordEventForActor`'s only import/call sites in the entire `src/` tree are its own owning
module (`live-match-event-store.ts`) and the one internal, HMAC-only endpoint
(`/api/internal/live-match/events`). `recordEvent()` (the underlying wrapper) keeps its one
legitimate remaining caller, `planned-rotation-live-actions.ts` — a server-triggered write
applying a planned rotation, not a browser race with the coordinator, and therefore not part of
this residue.

## Related decisions

- ADR-0138 (Canonical Live Operation Stream, Persisted Sequence, and Scoped Offline Continuation)
- ADR-0086 (Live match realtime coordination runs on Cloudflare Durable Objects) — amended by
  ADR-0138; see that ADR's own "Amendment" section and History entry.

## Related implementation

- `src/components/live-match/league-live-match-client.tsx`
- `src/app/(app)/matches/[matchId]/live/live-actions.ts`
- `src/lib/live-match/live-match-event-store.ts`
- `src/app/api/internal/live-match/events/route.ts`
- `src/lib/live-match/local/live-sync.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-12

Record created during Bundle 1 (contract/ADR/residue alignment) of the Canonical Live Operations
& Delayed-Concurrency programme. Confirmed via direct code audit against `main`@`f6cd772a`, not
assumed from the programme brief's own conservative description.

### 2026-09-13

Resolved during Bundle 4 ("One canonical mutation path"). See "Disposition" above for the exact
code changes and the new static test suite proving every resolution criterion. Note: the
coordinator-level conflict-detection mechanism Bundle 3 added was, until this resolution, silently
bypassed by the very HTTP fallback this ARR describes — Bundle 3's own `PROGRAMME_STATE.md` entry
disclosed this explicitly. That disclosed gap is now closed for League.
