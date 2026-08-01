# ADR-0048: Revision-Specific Review and Personal Attention

## Status

Proposed

## Context

Matchboard needs a lightweight review workflow for event squads and match lineups, and a personal attention projection that surfaces actionable work items from live domain state.

Review is advisory: it never blocks squad or lineup operations. Each review targets an immutable revision. When the target changes, pending reviews are superseded.

Personal attention is a projection of domain state (reviews assigned, invitations pending, missing reports, expiring access), not an independent task table.

## Decision

### Review model

Add `ReviewRequest` with statuses: PENDING, APPROVED, CHANGES_REQUESTED, CANCELLED, SUPERSEDED.

Target types: EVENT_SQUAD, MATCH_LINEUP.

Each request targets a specific revision. Editing supersedes pending reviews. Reviewer must be in the same organisation, hold an eligible role, and not be the requester.

Review actions do not mutate the reviewed target. Approval is advisory.

### Personal attention

Attention entries are computed from live domain state, not stored as independent rows. The attention projection service and the Assistant page use the same source data.

Initial attention sources: review assigned to actor, invitation requiring action, invalid or stale lineup, missing post-match report, expiring SUPPORT access, seasonal finalisation checkpoint.

## Consequences

- Review adds a new model and two enums (ReviewTargetType, ReviewStatus) to the Prisma schema
- Attention requires no new model; it is derived from existing domain state
- The review workflow is optional and advisory
- Superseding preserves history for audit
- Attention and Assistant remain consistent through shared projection