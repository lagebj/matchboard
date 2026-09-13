# ARR-0048: League/Event live-mutation authorization asymmetry (report mode)

## State

Identified

## Identified

2026-09-13

## Residue

While wiring Event into the live-match realtime coordinator (ADR-0138 Bundle 8, closing
ARR-0046), a direct audit of `/api/live-match/[matchId]/realtime-ticket/route.ts` found League
and Event use genuinely different authorization models for the same conceptual operation —
obtaining a `"report"`-capability realtime ticket, the credential that lets a device mutate a
live match session:

- **League**: `requireMutationRole(ctx)` (org-level) **and**
  `requireMatchGroupMutationRole(ctx, matchId)` (`GROUP_COACH` specifically on the match's own
  `footballGroupId`) — both must pass.
- **Event**: `requireMutationRole(ctx)` (org-level) **only**. There is no equivalent group-level
  check anywhere in Event's own live-reporting authorization path
  (`startEventLiveSessionAction`/`heartbeatEventAction`/the Event branch of the realtime-ticket
  route/`recordEventForActorEvent`) — confirmed by grepping every Event live-match action file
  for `requireGroupAccess`/`requireGroupMutationRole`/`hasGroupAccess` and finding none.

This is not new to Bundle 8 — it is Event's existing, pre-existing authorization pattern
everywhere else in this codebase (every Event server action file uses org-level
`requireMutationRole` only, never a group-level check). Bundle 8 did not introduce or change it;
it surfaced it while building the ticket route's Event branch, because that is the first place
League's stricter model sits directly beside Event's looser one in the same function for direct
comparison. Bundle 8's own new Event **"view"**-mode (Follow Live) capability was given a
group-level check (`requireGroupAccessFromContext` on the Event's `footballGroupId`) as a
deliberate match to League's existing Follow Live design for that one new, additive capability —
that gap is closed. This ARR is only about the pre-existing **"report"**-mode (mutation)
asymmetry, which Bundle 8 left exactly as it already was.

Practical consequence: in an organisation where a coach has org-level mutation role (e.g. `COACH`)
but has only been granted `GROUP_VIEWER` (read-only) access to a specific Group's Event, that
coach can still start/record/end an Event's live-reporting session for that Group's match — the
same class of gap AGENTS.md's "Group-role-aware live match authorization" section documents was
already fixed for League matches ("closing a pre-existing gap") but was apparently never carried
over to Event when Event's own live-reporting actions were originally built.

## Intended architecture

Undecided. Two credible directions exist and neither has been chosen yet:

1. Extend Event's live-reporting mutation authorization to also require `GROUP_COACH` on the
   Event's `footballGroupId`, matching League's `requireMatchGroupMutationRole` model exactly
   (symmetry, closes the practical gap above).
2. Deliberately keep Event org-level-only for mutation, on the basis that Event's overall
   permission model (squad generation, lineup editing, all other Event actions) is consistently
   org-level-only today — extending only live-reporting to be stricter would itself create a new,
   narrower asymmetry (this one action requiring more than every other Event action).

Choosing between these is a real authorization-model decision (which changes who can mutate a
live Event match), not a residue-cleanup task — it needs an ADR, not a code fix under this ARR.

## Evidence

- `src/app/api/live-match/[matchId]/realtime-ticket/route.ts` — League branch calls
  `requireMatchGroupMutationRole(ctx, matchId)` for `mode: "report"`; the Event branch (added in
  this same bundle) calls only the shared top-of-function `requireMutationRole(ctx)`, with an
  explicit comment noting the asymmetry is deliberately preserved, not fixed, here.
- `src/app/(app)/events/[eventId]/event-live-actions.ts` — `startEventLiveSessionAction`,
  `heartbeatEventAction`, and (before its Bundle 8 removal) `recordEventLiveEventAction` all use
  `requireMutationRole(ctx)` only.
- `src/lib/live-match/event-live-match-event-store.ts`'s `recordEventForActorEvent()` — no
  group-level check (it runs behind the internal HMAC-only endpoint, which trusts the ticket's
  already-decided capabilities; the ticket route above is the actual enforcement point).
- Contrast: `src/lib/auth/actor-context.ts`'s `requireMatchGroupMutationRole()`/
  `requireMatchGroupAccess()`, and AGENTS.md's "Group-role-aware live match authorization"
  section documenting the equivalent League-only fix already made.

## Impact

- A coach with org-level mutation role but only `GROUP_VIEWER` access to an Event's Group can
  start, record events for, and end that Event's live-reporting session — narrower privilege
  than the same coach would have for an equivalent League match in the same Group.
- Any future work that assumes "Event live-reporting authorization matches League's" (as ADR-0112
  states as a general goal, and as ADR-0138 states for the *protocol/behavioral* contract) must
  not silently assume this extends to the *authorization* model too — it does not, today.

## Containment

- Do not silently harden or loosen this in an unrelated change. A change to Event's live-mutation
  authorization model is an authorization-model decision requiring an ADR first.
- Do not extend League's `requireMatchGroupMutationRole` pattern into Event's live-reporting path
  without that ADR — doing so without deciding direction 1 vs. 2 above risks a narrower, new
  asymmetry (only live-reporting, not Event's other actions, becoming group-scoped).
- New Event live-reporting code must not assume group-level authorization already exists.

## Resolution criteria

- [ ] An ADR decides whether Event live-reporting mutation authorization should match League's
      group-level model, stay org-level-only for consistency with Event's other actions, or some
      other explicit direction.
- [ ] The decided direction is implemented and covered by an authorization regression test
      (mirroring the existing League `requireMatchGroupMutationRole` rejection test) proving the
      chosen behavior, not merely absence of a check.

## Disposition

Undispositioned — awaiting the ADR described above. Recorded now (rather than silently left
unrecorded) per this codebase's "when an ARR is discovered during code work, record it before
continuing" rule.

## Related decisions

- ADR-0138 (Canonical Live Operation Stream, Persisted Sequence, and Scoped Offline Continuation)
  — Bundle 8 surfaced this while wiring Event's realtime-ticket "report"/"view" dispatch.
- ADR-0086 (Live match realtime coordination runs on Cloudflare Durable Objects) — the
  ticket-issuance boundary this asymmetry lives in.

## Related implementation

- `src/app/api/live-match/[matchId]/realtime-ticket/route.ts`
- `src/app/(app)/events/[eventId]/event-live-actions.ts`
- `src/lib/auth/actor-context.ts` (`requireMutationRole`, `requireMatchGroupMutationRole`,
  `requireGroupAccessFromContext`)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-13

Record created during ADR-0138 Bundle 8 (Canonical Live Operations & Delayed-Concurrency
programme), while implementing Event's realtime-ticket "report"/"view" dispatch. Confirmed via
direct code audit that Event's live-reporting mutation authorization has always been org-level
only, with no equivalent to League's group-level `requireMatchGroupMutationRole` check.
