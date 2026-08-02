# ADR-0045: Review, Attention and notification hardening

## Status

Proposed

## Date

2026-08-01

## Context

The current notification system has an outbox pattern but does not create notifications transactionally with domain mutations. The webhook endpoint skips authentication when the webhook key is not configured. There is no review domain, no personal Attention inbox, and no idempotency key for notification deduplication.

The deferred work specification requires:
- Transactional enqueue (domain mutation and outbox row in the same transaction)
- Mandatory webhook authentication
- Idempotency keys for all notifications
- Revision-specific advisory review (not blocking)
- Personal Attention projection shared with Assistant
- Disabled open/click tracking

## Decision

### Transactional notification enqueue

1. All notification creation must occur inside the same Prisma `$transaction()` as the domain mutation
2. The `enqueueNotification()` function already accepts a `tx` parameter — all call sites must use it
3. If the domain mutation fails, the notification must not be sent
4. If the notification enqueue fails, the domain mutation must roll back

### Idempotency

1. Add `idempotencyKey` field to `NotificationOutbox` model (unique)
2. `enqueueNotification()` checks for existing entries with the same key before creating
3. Worker retries use the existing outbox entry ID for idempotency

### Webhook authentication

1. `BREVO_WEBHOOK_KEY` must be mandatory in production
2. When `BREVO_WEBHOOK_KEY` is not set, the endpoint must return 503 (service unavailable), not silently accept
3. The existing HMAC-SHA256 verification is preserved
4. Open and click tracking must be disabled in Brevo template configuration

### Revision-specific review

1. Create `ReviewRequest` model with fields: id, organisationId, targetType, targetId, targetRevision, requestedByMembershipId, reviewerMembershipId, status (PENDING/APPROVED/CHANGES_REQUESTED/CANCELLED/SUPERSEDED), requestMessage, reviewerComment, resolvedAt, supersededById, timestamps
2. Review targets: EVENT_SQUAD, MATCH_LINEUP
3. Review is advisory — it never blocks normal squad or lineup use
4. When the target changes, pending reviews become SUPERSEDED
5. Reviewer must: belong to same organisation, have active membership, have access to target team or event, hold eligible role, not be the requester

### Personal Attention

1. Attention is a projection of domain state, not a persisted task table
2. Create `/o/{organisationSlug}/attention` route
3. Attention entries derive from: reviews assigned to actor, requested changes on actor-owned work, invitations requiring action, stale lineup assignments, missing reports, handovers requiring acknowledgement, expiring SUPPORT access, seasonal finalisation checkpoints
4. Attention and Assistant must use the same projection service
5. An Attention entry resolves when its source domain resolves — no independent checkbox

## Consequences

- Notification creation is atomic with domain mutations
- Webhook authentication is mandatory in production
- Review is advisory and revision-specific
- Attention is a live projection, not a persisted task list
- No duplicate notifications from retries or double-clicks

## Related

- ADR-0043 (Brevo transactional email subsystem)
- 04-notifications-review-attention.md (deferred work specification)
- MB-DW-008, MB-DW-009, MB-DW-010, MB-DW-011