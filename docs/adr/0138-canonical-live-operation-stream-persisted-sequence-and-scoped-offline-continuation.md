# ADR-0138: Canonical Live Operation Stream, Persisted Sequence, and Scoped Offline Continuation

## Status

Accepted

## Date

2026-09-12

## Decision owners

- Maintainer (via the Canonical Live Operations & Delayed-Concurrency programme brief,
  `.matchboard-work/canonical-live-operations/` — gitignored working bundle, not part of this
  repository's tracked history, mirroring how ADR-0086 references its own SPEC.md)

## Context

ADR-0086 introduced the Cloudflare Durable Object (`workers/live-match/`) as a coordination
layer for live match reporting, with the existing HTTP/local-first path preserved as a permanent
fallback and de facto kill switch. ADR-0112 unified reporter and Follow Live onto one projection.
ADR-0133 hardened clock persistence, score reconciliation, and keepalive after a 2026-09-09
production incident. None of these decided the model needed for **delayed concurrency**: a coach
recording match events while genuinely offline, on a device that may not reconnect until well
after other devices have recorded their own actions.

A repository audit (2026-09-12, against `main`@`f6cd772a`) confirmed the following as verified
current behaviour, not assumption:

1. **Two canonical write paths for League.** `league-live-match-client.tsx`'s `recordEvent` tries
   the Durable Object first (`realtime.tryRecordEvent()`), then falls through to
   `recordLiveEventAction` — an ordinary server action that calls `recordEventForActor()` and
   writes directly to Neon — whenever the realtime attempt is unavailable or its
   `persistenceStatus` is not yet `"persisted"`. Both paths converge on the same
   `recordEventForActor()`, deduplicated only by the `clientEventId` unique constraint. This
   satisfies "one owning implementation" for persistence, but not "one command-sequencing
   authority": the browser can create a canonical Neon row that the Durable Object's `version`
   counter never ordered.
2. **Event live reporting has no Durable Object involvement at all.** `event-live-match-client.tsx`
   calls `recordEventLiveEventAction` unconditionally — pure HTTP, no realtime client, no
   `persistClock`, no reconnect/presence wiring. League and Event are not "not fully equivalent
   in some persistence details" (as the programme brief conservatively assumed); Event has zero
   coordinator involvement.
3. **`src/lib/live-match/local/live-sync.ts` (`recordEventLocallyFirst`) is dead code.** No file
   imports it. The actual local-first behaviour lives inline in `live-match-client.tsx`, which
   calls the injected `actions.recordEvent` — i.e. it inherits whichever of the two paths above
   the League/Event adapter wires up. `live-sync.ts` and its would-be dual-write pattern were
   never actually reachable in production.
4. **No persisted canonical sequence exists anywhere.** `LiveMatchEvent`/`EventLiveMatchEvent`
   have no `sequence`, `acceptedAt`, `clientCapturedAt`, or `originClientId` fields; the only
   unique constraint is `@@unique([clientEventId])`. Every ordering read
   (`live-match-event-store.ts`, `event-live-match-event-store.ts`, `report-mutations.ts`) sorts
   by `createdAt`. The Durable Object's own `version` counter is in-memory/session-scoped and is
   never persisted alongside the event it ordered.
5. **`CanonicalLiveEvent` (the realtime wire type) has no `sequence` and no `correctsEventId`.**
   `RecordEventCommand.baseVersion` is the only concurrency signal, and it invalidates a
   state-sensitive command on *any* accepted event since, not just a conflicting one — an
   unrelated goal can make a pending rotation stale.
6. **The live projection's reversal handling has a real, confirmed bug, distinct from the
   already-documented realtime-wire gap.** `projectCanonicalLiveState` marks the *reversal*
   event's own id in its `reversedEventIds` set instead of the id the reversal targets
   (`correctsEventId`, which the wire type doesn't carry to begin with) — so a reversed goal is
   never actually excluded from the live projection's own score calculation. This is a second,
   separate defect from the already-known "Follow Live can briefly show a reversed goal before
   the next full reconcile" residual recorded in ADR-0133; `seedReportFromLiveSession()`
   (`report-mutations.ts`) implements the correct version independently, by reading raw Neon rows
   and filtering on `correctsEventId` directly.
7. **Local IndexedDB synchronization state is a plain boolean** (`LocalEvent.synced`), unable to
   distinguish "not yet sent" from "accepted but not yet durably persisted" from "genuinely
   conflicting."
8. **No service worker exists anywhere in the codebase.** `AGENTS.md`'s PWA section and
   `features/matchboard.feature`'s "Progressive Web App installation" feature both currently
   state Matchboard introduces no offline caching and registers no service worker — correct today,
   and this ADR deliberately narrows, not removes, that invariant.

None of this is a criticism of prior work: ADR-0086/0112/0133 solved real problems (shared-view
consistency, a live production incident, and give the coordinator a persistence path at all) and
their guarantees are preserved as invariants below. What they did not yet decide is how to handle
two devices making valid, independent, or genuinely conflicting decisions from a shared-but-stale
starting point — the problem this ADR resolves.

### Why not a CRDT framework

A CRDT (e.g. Automerge, Yjs) would give automatic merge semantics for arbitrary concurrent state,
but Matchboard's live-match state is not arbitrary: it has football-domain meaning (a player
cannot be both on and off the field; a goal cannot be un-scored by merge algebra; a reversal must
target one specific event). A general CRDT would either (a) need the exact same domain-precondition
logic layered on top to reject "two removals of the same player" as anything other than "both
happened," defeating the purpose of adopting it, or (b) silently converge to a technically
consistent but footballically wrong state (e.g. last-write-wins on a lineup slot). A central
sequencer with domain-aware preconditions gives exact control over which operations may
auto-merge (additive) and which must surface for coach review (state-sensitive with a broken
precondition) — a CRDT cannot express "ask the human" as an outcome. No CRDT dependency is
introduced by this ADR, and none should be introduced later without a fresh ADR explicitly
showing this model cannot satisfy a real, encountered requirement.

### Why not general Matchboard event sourcing

This ADR's operation stream is scoped to live match execution and its direct consumers (Follow
Live, post-match handoff, evidence). It does not convert Team/Player/Selection/Round CRUD to
event sourcing. Those domains have no delayed-multi-device-concurrency problem to solve, and
`AGENTS.md`'s existing "boring architecture" preference for this repository weighs against
introducing event sourcing anywhere it isn't specifically required.

## Decision

### 1. One canonical operation stream, one command-sequencing authority

After the migration in this ADR completes, the match's Cloudflare Durable Object
(`MatchSessionObject`, ADR-0086) is the **only** normal path by which a new live operation is
canonically ordered. This amends ADR-0086's original decision (which explicitly treated direct
HTTP persistence as an equally-valid concurrent path, "the browser writes... over ordinary HTTP
requests... this works") and ADR-0086's Stage 5 fallback ("HTTP is the fallback used specifically
when realtime is unavailable" — that remains true for *transport availability*, but no longer
permits an independently-ordered canonical write):

- The browser attempts the realtime path first, as today.
- If the coordinator is unavailable, the browser keeps the command in its local durable outbox
  and retries. **It must not fall through to a direct Neon-writing server action as an alternate
  canonical path.** The existing HTTP server action becomes an adapter that the coordinator's own
  persistence flow uses internally (via the signed internal endpoint), not an independent
  caller-facing canonical write surface.
- Event live reporting gains real Durable Object coordination, closing finding (2) above — League
  and Event share one behavioural contract (protocol, classification, sequence, projection,
  outbox, conflict handling, Follow Live), even if they keep separate Prisma tables/adapters.

`recordEventForActor()` remains the single owning persistence implementation (unchanged from
ADR-0086's "one business operation, one owning implementation" framing) — what changes is who is
allowed to call it as a *caller-facing* operation versus only as an *internal* step behind the
coordinator.

### 2. Protocol v2: persisted canonical sequence + domain-aware preconditions replace the global `baseVersion`

Every canonically accepted live operation receives an explicit per-session integer `sequence`
(starts at 1, increments by 1, unique per session, persisted in Neon, never reconstructed from
`createdAt`). `sequence` is acceptance order; the existing `period` + legacy-named-but-millisecond
`matchSeconds` field remains football time; `capturedAtClientMs`/`acceptedAt` remain diagnostic
wall-clock timestamps. These are three different concepts and must never be conflated — in
particular, a late offline operation can have an earlier football time but a later canonical
sequence, and replay must always order by sequence.

The single global `baseVersion` (ADR-0086 Stage 5/6) is replaced by domain revisions
(`clockRevision`, `lineupRevision`, `annotationRevision`) plus explicit semantic precondition
checks evaluated against current canonical projected state (e.g. `ROTATION_OUT` requires the
target participant to currently be on field; `EVENT_REVERSED` requires its target event to exist
and still be active). This directly fixes finding (5): an additive goal no longer invalidates an
unrelated pending rotation, because only lineup operations touch `lineupRevision`, and the
rotation's actual precondition (is the player still on field) is what is actually checked, not
"has *anything* changed since I last saw canonical state."

Every `LiveMatchEventType` value is given an explicit, exhaustive append-safe/state-sensitive
classification (superseding `workers/live-match/src/state.ts`'s current catch-all "everything not
in the state-sensitive set defaults to append-safe"). A new enum value must fail a test or
compile-time exhaustiveness check until explicitly classified — this closes a real safety gap: a
future event type could otherwise silently become append-safe by omission.

A genuine conflict — a state-sensitive operation whose precondition no longer holds — becomes a
structured, machine-readable outcome (a closed set of conflict codes) and a browser-local
`NEEDS_REVIEW` state. It is never resolved by last-write-wins, silent drop, silent rewrite of
player/position identity, or an invented equivalent operation. The coach reviews current state and
either records a new action (new `clientEventId`, evaluated against current preconditions) or
explicitly discards the stale local intent.

### 3. Canonical wire event becomes replay-complete

`CanonicalLiveEvent` gains `sequence` and complete correction metadata (`correctionType`,
`correctsEventId`) so a consumer can replay exact observable truth without a further database
lookup. This directly fixes finding (6): the projection's reversal handling is rewritten against
target-event-id resolution, and its own replay/merge ordering moves from `createdAt` comparison to
`sequence` comparison. The projection is also extended to include position state
(`POSITIONS_CHANGED` currently produces no projected output at all) and becomes the one pure
function both Live Reporting and Follow Live consume for every observable fact — no surface
maintains an independently-calculated score, clock, on-field set, or position state.

### 4. Local durability precedes network send; IndexedDB is an outbox, not truth

For every live action: generate `clientEventId` → build the command → persist to IndexedDB → apply
the local optimistic overlay → attempt synchronization. A browser crash after the local write must
never lose the action. The boolean `synced` field is replaced with an explicit local command state
machine (`LOCAL_PENDING` → `SENDING` → `ACCEPTED_PENDING_PERSISTENCE` → `PERSISTED`, with
`NEEDS_REVIEW` and `FAILED_TERMINAL` as terminal-but-retained states). Automated cleanup may only
remove rows that are durably `PERSISTED` and past a short retention window — it must never remove
an unresolved (`LOCAL_PENDING`/`NEEDS_REVIEW`/`FAILED_TERMINAL`) row.

### 5. Scoped offline continuation, not general offline mode

This ADR narrows, but does not remove, the existing "no offline caching, no service worker"
invariant (`features/matchboard.feature`'s "Progressive Web App installation" feature; ADR-0123
point 5). The narrowed rule:

> A device that has successfully established a live-reporting session and downloaded the required
> match package while online can continue to record match operations when connectivity
> disappears — through temporary network loss, WebSocket-only loss, full network loss, page
> refresh, or an installed-PWA/browser restart on the same device. This does **not** make broad
> Matchboard data offline-capable. A never-prepared device opening Matchboard for the first time
> without network access remains out of scope and shows an explicit "connect to prepare this
> match" state, not stale or fabricated content.

Any service worker introduced for this purpose caches only the static shell/assets required to
render the established live route and a generic offline fallback — never arbitrary authenticated
SSR HTML, and never longitudinal player development data. The prepared match package (roster,
starting lineup/positions, period configuration, last canonical snapshot, local outbox) lives in
IndexedDB, not Cache Storage.

### 6. Session end is not immediate stream sealing; locked history stays immutable

`MATCH_END` ends the football clock and normal live-action mode; it does not immediately destroy
unsynchronized local intent, and does not clear the local queue. During the bounded window while
the post-match report remains mutable, delayed append-safe operations may still synchronize and
delayed state-sensitive operations are evaluated normally (accept or `NEEDS_REVIEW`). The canonical
stream becomes sealed when the post-match report is completed/locked (reusing the existing
report-lock boundary, not a new independent seal timestamp) — after sealing, no new canonical live
operations are accepted, and a locked report is never mutated by a late-arriving local command. This
composes with, and does not change, ADR-0109's existing planning-boundary/report-lock model.

### 7. Migration discipline

Additive, staged rollout only — schema fields nullable first, dual-protocol tolerance during
rollout, final cutover preferring a window with zero active live sessions, no destructive rewrite
of existing rows. `docs/development/live-match-realtime.md` is the durable procedural reference
for the exact staged sequence; the full staging detail is also recorded in this programme's working
bundle. Legacy pre-sequence rows are backfilled deterministically (session, then `createdAt`, then
row id as tie-breaker) for replay compatibility — this is documented as establishing deterministic
*historical* replay, not proof of original realtime acceptance order; strong ordering guarantees
begin at v2 cutover. No replay may mutate a locked report or retroactively change a player's
profile attributes/positions as if replay were a new observation.

## Rationale

The core forces are: (a) a coach must never lose a recorded action because of connectivity, (b)
two coaches must never have their independently-valid actions collapse into one winner, (c) a
genuine conflict must be visible and resolvable, never silently guessed, and (d) none of this may
weaken Neon's role as durable system of record or introduce a second, competing ordering
authority. A single sequencer (already partially present via the Durable Object) plus
domain-aware operation semantics satisfies all four without adopting general-purpose distributed
systems machinery this codebase does not otherwise need.

## Alternatives considered

### Keep the dual HTTP/DO write path, only harden retries

Rejected: this is the actual current defect, not a acceptable interim state. Two independently
ordered canonical writers can never be reconciled into one true sequence after the fact — the
programme's entire purpose is to remove this, not tolerate it further.

### Adopt a CRDT library (Automerge/Yjs) for lineup/clock state

Rejected — see "Why not a CRDT framework" in Context.

### Whole-state last-write-wins with a single global version (status quo `baseVersion`)

Rejected: directly causes the false-conflict problem in finding (5) — an unrelated additive event
invalidates a legitimate pending action, degrading collaboration exactly when it matters most
(a busy multi-device matchday).

### General Matchboard event sourcing

Rejected — see "Why not general Matchboard event sourcing" in Context. No other Matchboard domain
has this program's specific delayed-multi-device problem.

## Consequences

### Positive

- One true, replayable canonical order for live match execution, surviving Durable Object
  restart/hibernation because it is persisted in Neon, not reconstructed from wall-clock time.
- Additive operations from different devices converge automatically; genuine conflicts are
  visible and actionable instead of silently lost or overwritten.
- League and Event reporting finally share one real behavioural contract instead of Event lacking
  coordinator involvement entirely.
- A coach can continue reporting through a real connectivity gap on an already-prepared device
  without losing recorded actions.

### Negative / accepted costs

- More protocol/schema surface (sequence columns, domain revisions, an outbox state machine) than
  the current boolean-sync/global-version model.
- A staged, multi-bundle migration is required; mid-migration states (dual protocol tolerance,
  nullable `sequence`) must be carried correctly and removed only after verified cutover.
- A service worker is introduced to the codebase for the first time, narrowly scoped; it adds a
  new class of caching bug surface that must be kept to the documented minimal live-route scope.

### Risks and mitigations

- **Sequence integrity error (two different events claiming the same sequence).** Never
  auto-resolved; forces a resync and operator-visible telemetry, per
  `OBSERVABILITY_RECOVERY_ROLLOUT.md`'s recovery-case table.
- **Migration mid-state confusion (v1 vs v2 clients).** Bounded by explicit protocol versioning
  and a documented compatibility window, removed only after verified zero legacy usage.
- **Scope creep of the offline/service-worker exception into general offline mode.** Prevented by
  this ADR's explicit narrow wording and by `features/matchboard.feature`'s corresponding
  scenarios asserting broad authenticated pages remain server-fetched.

## Migration and compatibility

Additive schema changes only in the first phase (`sequence Int?`, `acceptedAt DateTime?`,
`clientCapturedAt DateTime?`, `originClientId String?` on both `LiveMatchEvent` and
`EventLiveMatchEvent`; a `@@unique([sessionId, sequence])`-equivalent constraint added once
backfill is verified). Existing `@@unique([clientEventId])` constraints are retained unchanged.
Full staged sequence: see `docs/development/live-match-realtime.md` (to be updated across this
programme's bundles) and this ADR's own summary in "Migration discipline" above.

## Security and operations

No change to the trust boundary established by ADR-0086 (ticket-issued WebSocket authentication,
HMAC-signed internal persistence endpoint) or to core invariants (participant IDs are always
validated against the effective live roster server-side; `organisationId`/user identity is never
trusted from a client payload; canonical sequence is assigned server-side only, never accepted
from a client). Logging remains minimized to IDs, counts, status, sequence, error/conflict codes —
never full payload dumps or child names, per this repository's existing audit-logging policy.
Operational visibility (stuck outboxes, retry exhaustion, conflict rates, idle Durable Object
verification) is delivered progressively across the implementation bundles; see this programme's
working bundle for the full observability plan.

## Related records

- ADRs: ADR-0086 (amended by this decision — see that ADR's History entry below), ADR-0112
  (canonical projection principle extended, not superseded), ADR-0123 (amended — offline-caching
  invariant narrowed for the live-reporting route only, see that ADR's own note), ADR-0109
  (planning-boundary/report-lock model reused, unchanged, as the stream-sealing boundary),
  ADR-0133 (all listed hardening invariants preserved and carried forward explicitly)
- ARRs: ARR-0045 (dual canonical live-event write path), ARR-0046 (League/Event live-coordination
  asymmetry), ARR-0047 (live projection reversal-target defect and unpersisted canonical order)
- Security findings: none opened by this ADR; existing tenant/authorization tests must continue
  passing unchanged (see Bundle exit criteria in the programme's `TEST_MATRIX.md`)
- Issues or plans: `.matchboard-work/canonical-live-operations/IMPLEMENTATION_BUNDLES.md`
  (gitignored working bundle) — nine sequential implementation bundles

## Implementation evidence

Recorded per-bundle in `.matchboard-work/canonical-live-operations/PROGRAMME_STATE.md`
(gitignored working file) as each bundle completes, and summarized in this ADR's History section
as durable evidence lands.

## Supersedes

None. Amends ADR-0086 (write-path exclusivity after cutover) and ADR-0123 (offline-caching scope)
in place, per this repository's append-only ADR convention — see each ADR's own History/note
entries.

## Superseded by

None.

## History

### 2026-09-12

Record created (Bundle 1 of the Canonical Live Operations & Delayed-Concurrency programme). This
ADR documents the accepted architecture direction ahead of implementation; protocol v2, persisted
sequence, the durable local outbox, and scoped offline continuation are not yet implemented in
code as of this entry. See `PROGRAMME_STATE.md` for live bundle-by-bundle progress and evidence.
