# ADR-0140: Event live-reporting mutation is group-role-aware

## Status

Accepted

## Date

2026-09-14

## Context

League and Event now share the canonical live-operation protocol and Durable Object coordination model established by ADR-0138. ARR-0048 identified one remaining authorization asymmetry.

League report-mode live mutation requires both organisation mutation authority and `GROUP_COACH` authority for the match's football group. Event report-mode live mutation historically required only organisation mutation authority.

This allowed a user with organisation role `COACH` but `GROUP_VIEWER` access to a specific Event's group to mutate that Event's live match execution even though the same group role is read-only for League live reporting and for Event Follow Live.

Live reporting is not ordinary planning. It creates the factual match execution record and feeds post-match reporting and evidence.

## Decision

Event live-reporting mutation requires:

1. organisation mutation authority (`OWNER`, `ADMIN`, or `COACH`); and
2. for non-admin users, `GROUP_COACH` authority on the Event's `footballGroupId`.

`OWNER` and `ADMIN` retain the same administrative bypass used by League.

The rule applies to all caller-facing Event live mutation boundaries:
- start live session;
- report-mode realtime ticket issuance;
- live clock persistence;
- heartbeat/session maintenance mutation;
- end live session;
- live-session-to-post-match-report handoff.

Event Follow Live remains read-only and continues to allow both `GROUP_COACH` and `GROUP_VIEWER`.

The Durable Object continues to enforce ticket capability. A view ticket never receives report capability.

This decision does not change the wider Event planning authorization model. Event squad generation, lineup editing and other Event planning actions remain outside this ADR.

## Rationale

A group viewer is explicitly read-only for that football group. Allowing the same user to write factual live execution data would violate that boundary.

League and Event now share the same live execution architecture. Their report mutation authority should therefore also have the same group-level meaning.

This is deliberately narrower than a general Event authorization redesign. Live execution has a higher integrity requirement because it becomes historical match evidence.

## Alternatives considered

### Keep Event live mutation organisation-scoped only

Rejected. It allows `GROUP_VIEWER` users with an organisation mutation role to alter a group's factual match record.

### Make all Event mutations group-role-aware in the same change

Rejected for this ADR. That is a broader authorization redesign affecting planning workflows that are not required to close the live-reporting gap.

## Consequences

Positive:
- `GROUP_VIEWER` remains consistently read-only during live execution.
- League and Event report-mode authorization is predictable.
- the realtime report ticket becomes a trustworthy statement of group mutation authority.

Negative:
- Event live execution is now stricter than some older Event planning actions. This is intentional and documented.

## Implementation

- add one shared group-mutation-role check over `ActorContext.groupAccesses`;
- reuse it from League's match-group mutation helper;
- enforce it on Event report ticket issuance and all caller-facing Event live mutation actions;
- authorize before mutation;
- add regression tests for `GROUP_COACH`, `GROUP_VIEWER`, no group access, OWNER and ADMIN.

## Resolves

ARR-0048.
