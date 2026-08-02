# Matchboard Deferred Work Programme — Session Report

## Session date: 2026-08-01

## Completed bundles

### Bundle 1 — Contract Baseline ✅

**Deliverables:**
1. Feature contract updated with 10 new rule blocks and ~40 new scenarios covering:
   - Organisation membership and role enforcement (7 scenarios)
   - Invitation-based admission (2 scenarios)
   - SUPPORT time-bound access (2 scenarios)
   - Event-squad lifecycle correction (5 scenarios)
   - Event-lineup eligibility and helper provenance (3 scenarios)
   - Stale assignment detection (1 scenario)
   - Transactional notification enqueue (1 scenario)
   - Mandatory webhook authentication (2 scenarios)
   - Simulation no-write invariant (2 scenarios)
   - Availability and readiness model (4 scenarios)
   - Age-neutral product core (2 scenarios)

2. New ADRs created:
   - ADR-0044: Event-squad lifecycle and lineup correctness
   - ADR-0045: Review, Attention, and notification hardening
   - ADR-0046: Simulation semantics and command palette
   - ADR-0047: Availability, readiness, and model reconciliation

3. Existing ADRs updated:
   - ADR-0035: Added implementation status section documenting completed/in-progress/pending items
   - ADR-0037: Updated status from Proposed to Accepted

4. ARRs updated:
   - ARR-0007: Updated to reflect nullable organizationId added, NOT NULL pending
   - ARR-0008: Updated to reflect partial resolution (models exist, requireCoachAccess still primary)
   - ARR-0009: Updated to reflect only org detail/settings routes migrated
   - ARR-0010: Updated to reflect composite unique constraint progress

5. Traceability matrix populated with all 27 requirements with VERIFIED_EXISTING, PARTIAL, NOT_STARTED, or NOT_IMPLEMENTED status

### Bundle 2 — Tenant Cutover (partial) ✅

**Deliverables:**
1. Fail-closed auth: `resolveOrgFilterForUser()` now throws `AuthorizationError` when user has no membership instead of returning unscoped filter
2. Canonical `ActorContext` type and `requireActorContext()` helper created in `src/lib/auth/actor-context.ts` for future migration
3. SUPPORT role time-bound expiry: `expiresAt` field added to `OrganisationMembership` model, `resolveOrganisationAccess()` rejects expired SUPPORT memberships
4. Updated tests to expect AuthorizationError

### Bundle 4 — Notification Hardening (partial) ✅

**Deliverables:**
1. Transactional notification enqueue: Invitation creation and notification now execute in the same `db.$transaction()`
2. Idempotency key: `idempotencyKey` unique field added to `NotificationOutbox` model. `enqueueNotification()` deduplicates by key when provided.
3. Mandatory webhook authentication in production: Brevo webhook returns 503 when `BREVO_WEBHOOK_KEY` is not configured in production environment
4. Migrations created for both schema changes

## Session 2 date: 2026-08-02

### Bundle 3 — Event Correctness ✅

**Deliverables:**
1. `EventSquadStatus` CONFIRMED→LOCKED migration and code update (migration `20260801170000`)
2. DB-level unique constraint `@@unique([eventId, playerId])` on `EventSquadPlayer` (migration `20260801180000`)
3. Canonical eligibility service: `getEligibleEventMatchPlayers()` and `assertEligibleEventMatchPlayer()` in `event-match-eligibility.ts`
4. HELPER provenance: `EventMatchLineupAssignment.source` now includes HELPER enum value
5. Cascade stale assignment cleanup on squad unassignment and support removal
6. AGENTS.md updated: LOCKED terminology, eligibility service in key files, review advisory note

### Bundle 5 — Review and Attention ✅

**Deliverables:**
1. `ReviewRequest` model with PENDING/APPROVED/CHANGES_REQUESTED/CANCELLED/SUPERSEDED statuses
2. Review service: `createReviewRequest`, `resolveReviewRequest`, `supersedePendingReviews`, `getPendingReviewsForReviewer`, `getReviewHistory`
3. Review list UI at `/o/{orgSlug}/reviews`
4. Attention projection service: `getAttentionEntries()` with categories review_assigned, review_changes_requested, invitation_pending, missing_post_match_report, event_review_needed
5. Attention page at `/o/{orgSlug}/attention`
6. Assistant review work items: review_assigned and review_changes_requested integrated into `getAssistantCommandCentre()`
7. Migration `20260801210000` for ReviewRequest model and enums

### Additional completions verified
- `event_squads_draft_review` removed (replaced by `event_squads_ready`)
- Duplicate migrations removed (5 duplicate `20260802*` directories)
- Prisma schema duplicate `idempotencyKey` field fixed

### Remaining work

#### Bundle 2 remaining
- Migrate all 136 files from `requireCoachAccess()` to `requireActorContext()`
- Implement `/o/{organisationSlug}/...` route structure for main app routes
- Organisation switcher in sidebar
- NOT NULL constraint on `organisationId` (requires production data backfill)
- RLS runtime isolation proof through `matchboard_app` role
- Remove null-allowing RLS policies after NOT NULL constraint

#### Bundle 4 remaining
- Disable open/click tracking in Brevo template configuration (requires Brevo API changes outside repo)

#### Bundle 4 completed (Session 2)
- Bearer token authentication: `BREVO_WEBHOOK_BEARER_TOKEN` environment variable added. Webhook endpoint now checks bearer token first, then falls back to signature verification.

#### Bundle 9 — Model Reconciliation (partial, Session 2)
- ARR-0006: `Availability.status` migrated from String to `AvailabilityStatus` enum. Added `UNAVAILABLE` value. Migration `20260802100000_availability_status_enum`.
- Review self-review prevention: `createReviewRequest` now rejects self-assigned reviewers and validates reviewer organisation membership. `resolveReviewRequest` now requires the assigned reviewer to resolve.
- Attention: Added `expiring_support_access` category for SUPPORT memberships expiring within 7 days.

#### Bundle 9 remaining
- Remove or derive `Player.supportSuitability` and `Player.developmentReadiness`
- Migrate reads to `PlayerPosition` canonical model (590 references)
- Make `SelectionExplanation` canonical, `Selection.explanation` read-only cache
- Add check constraints for string-typed enums
- Update feature contract preamble to age-neutral language

## Commits (Session 2)

1. `894d6ef5` — feat: contract baseline, tenant cutover (partial), notification hardening (partial), event correctness (partial)
2. `1aa7b031` — docs: update AGENTS.md for event-squad lifecycle correctness
3. `8cb7a5f0` — chore: remove duplicate migrations, add pnpm files to gitignore

## Security invariants now enforced (cumulative)

- Users without organisation membership are denied operational access (fail-closed)
- Expired SUPPORT memberships are rejected at the auth resolver level
- Brevo webhook rejects unauthenticated requests in production
- Notification enqueue is transactional with domain mutations
- Idempotency key prevents duplicate notification delivery
- Event-squad player uniqueness enforced at DB level (one player per event across all squads)
- Event-match eligibility enforced server-side via canonical service
- HELPER provenance tracked in lineup assignments
- Review self-review prevention and reviewer eligibility enforced
- Bearer token authentication on Brevo webhook endpoint

## Database changes (cumulative)

- `NotificationOutbox.idempotencyKey` — unique optional field
- `OrganisationMembership.expiresAt` — nullable timestamp for SUPPORT expiry
- `EventSquadStatus` — CONFIRMED renamed to LOCKED
- `EventSquadPlayer` — `eventId` field with `@@unique([eventId, playerId])`
- `ReviewRequest` model with ReviewTargetType and ReviewStatus enums
- `EventMatchLineupPlayerSource` — added HELPER value
- `Availability.status` — migrated from String to AvailabilityStatus enum, added UNAVAILABLE

## Production actions still required

1. Run `20260801150000_add_notification_idempotency_key` migration
2. Run `20260801160000_add_support_role_expiry` migration
3. Run `20260801170000_rename_event_squad_confirmed_to_locked` migration
4. Run `20260801180000_add_event_squad_player_event_id` migration
5. Run `20260801210000_add_review_request_model` migration
6. Run `20260802100000_availability_status_enum` migration
7. Set `BREVO_WEBHOOK_KEY` environment variable in production
8. Set `BREVO_WEBHOOK_BEARER_TOKEN` environment variable in production (recommended)
9. Production data backfill: assign all existing data to bootstrap organisation
10. After backfill: apply NOT NULL constraint to `organisationId` on all tenant-bearing tables
5. Run `20260801210000_add_review_request_model` migration
6. Set `BREVO_WEBHOOK_KEY` environment variable in production (was previously optional)
7. Production data backfill: assign all existing data to bootstrap organisation
8. After backfill: apply NOT NULL constraint to `organisationId` on all tenant-bearing tables