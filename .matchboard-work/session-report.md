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
- Selection provenance columns enforce operational truth at DB level
- Database CHECK constraints enforce enum values for 9 string-typed fields across 7 models

#### Bundle 9 — Model Reconciliation (continued, Session 2)
- ARR-0002: Added provenance columns to `Selection` model (`manuallyAdded`, `manuallyRemoved`, `autoSelected`, `sourceTeamName`, `targetTeamName`, `selectionReason`). These extract operational flags from the JSON `explanation` field, making them queryable without JSON parsing. Migrated read paths in `generate-selection.ts`, `refresh-draft-selection.ts`, and round board page to use columns. Migration backfills from existing JSON.
- ARR-0002: Updated source-of-truth register and ARR-0002 document to designate `SelectionExplanation` table as canonical for structured explanations, `Selection.explanation` as compatibility cache, and provenance columns as operational truth.
- ARR-0003: Documented progress on `Warning.resolved` vestigial field. Confirmed that Assistant, Fixtures, Players overview, and reconciliation all use `computeRoundPlanIntegrity()` for live computation. Finalization still reads `Warning.resolved` from DB — migration to live computation pending.

#### Bundle 9 — Model Reconciliation (Session 3)

- ARR-0003 RESOLVED: All finalization, unfinalization, refresh, and display paths now use `computeRoundPlanIntegrity()` instead of `Warning.resolved` reads:
  - `finalize-match-round.ts`: Uses live plan integrity for blocker/decision-required detection; removed Warning table reads, WarningSeverity import, and `missing_movement_ledger` Warning creation during finalization
  - `finalize-single-match.ts`: Uses live plan integrity scoped to match; removed Warning table reads and `missing_movement_ledger` creation
  - `unfinalize-match-round.ts`: Uses `computeRoundPlanIntegrity()` for round status derivation after un-finalization
  - `unfinalize-single-match.ts`: Uses `computeRoundPlanIntegrity()` for status derivation
  - `refresh-draft-selection.ts`: Uses `reconcileRoundAfterDraftMutation()` for single-match refresh; added `reconcileRoundAfterDraftMutation()` call after round refresh
  - Round board page (`/rounds/[matchRoundId]/page.tsx`): Uses `computeRoundPlanIntegrity()` for signal display instead of Warning.resolved reads
  - `Warning.resolved` field is now effectively deprecated: no code path reads it for plan integrity or finalization decisions
  - Source-of-truth register updated; ARR-0003 disposition changed to Resolved

- Bundle 7 partial: Verified that simulation (`generateMatchRound()`) is already zero-write — it only reads from the database, never creates/updates/deletes football data. Corrected misleading comment that claimed simulation created draft selections. Updated dry-run notice to accurately reflect zero-write behavior.
- ARR-0006: Added database CHECK constraints for 9 string-typed enum fields across 7 models.
- ARR-0001: Confirmed Player scalar fields canonical, PlayerPosition is secondary derived store with zero active read paths.
- CoachingIntentScopeType.PLANNING_PERIOD renamed to LEAGUE_SEASON across all code and database. Aligned with user-facing terminology and existing LeagueSeason model rename.
- MB-DW-023: Removed "youth" qualifier from feature contract preamble and AGENTS.md. Product described as "football operations cockpit" without age restriction.

## Database changes (cumulative)

- `NotificationOutbox.idempotencyKey` — unique optional field
- `OrganisationMembership.expiresAt` — nullable timestamp for SUPPORT expiry
- `EventSquadStatus` — CONFIRMED renamed to LOCKED
- `EventSquadPlayer` — `eventId` field with `@@unique([eventId, playerId])`
- `ReviewRequest` model with ReviewTargetType and ReviewStatus enums
- `EventMatchLineupPlayerSource` — added HELPER value
- `Availability.status` — migrated from String to AvailabilityStatus enum, added UNAVAILABLE
- `Selection` — added `manuallyAdded`, `manuallyRemoved`, `autoSelected`, `sourceTeamName`, `targetTeamName`, `selectionReason` columns
- Database CHECK constraints added for: `MatchRound.status`, `PostMatchPlayerActual.attendanceStatus`, `PostMatchPlayerActual.source`, `Goal.type`, `Assist.type`, `EventGoalEvent.type`, `EventAssistEvent.type`, `EventPostMatchPlayer.attendanceStatus`, `EventMatchSupportAssignment.plannedRole`
- `CoachingIntentScopeType.PLANNING_PERIOD` renamed to `LEAGUE_SEASON`

## Production actions still required

1. Run `20260801150000_add_notification_idempotency_key` migration
2. Run `20260801160000_add_support_role_expiry` migration
3. Run `20260801170000_rename_event_squad_confirmed_to_locked` migration
4. Run `20260801180000_add_event_squad_player_event_id` migration
5. Run `20260801210000_add_review_request_model` migration
6. Run `20260802100000_availability_status_enum` migration
7. Run `20260802110000_add_selection_provenance_columns` migration
8. Run `20260802120000_add_enum_check_constraints` migration
9. Run `20260802130000_rename_coaching_intent_scope_planning_period_to_league_season` migration
7. Set `BREVO_WEBHOOK_KEY` environment variable in production
8. Set `BREVO_WEBHOOK_BEARER_TOKEN` environment variable in production (recommended)
9. Production data backfill: assign all existing data to bootstrap organisation
10. After backfill: apply NOT NULL constraint to `organisationId` on all tenant-bearing tables
5. Run `20260801210000_add_review_request_model` migration
6. Set `BREVO_WEBHOOK_KEY` environment variable in production (was previously optional)
7. Production data backfill: assign all existing data to bootstrap organisation
8. After backfill: apply NOT NULL constraint to `organisationId` on all tenant-bearing tables

## Session 4 date: 2026-08-02

### Bundle 6 — Command Palette (completed)

1. Command palette component (`src/components/shell/command-palette.tsx`) now fetches from `/api/command-palette` endpoint on open
2. `/api/command-palette` returns permission-filtered commands (navigation + create for coaches/admins, navigation only for viewers) and organisation list for switching
3. Org switching: non-current organisations appear as "Switch organisation" category items
4. Simulation page updated with "Apply as drafts" button that appears when simulation result is valid

### Bundle 7 — Planning Tools (completed)

1. **Apply simulation as drafts**: New `/api/simulation/apply` endpoint that re-runs `populateAllDrafts` pipeline for non-finalized rounds, with authorization and rate limiting
2. **Stale-input detection**: `/api/simulation/input-hash` endpoint computes hash of current input state (player count, match count, availability count, rotation path count, round IDs). Apply endpoint rejects requests when input data has changed since simulation was run (HTTP 409)
3. **validToCommit computed dynamically**: `SeasonSimulationResult.validToCommit` now computed from whether all rounds are valid and have no blocked-level warnings, instead of hardcoded `false`
4. **Apply simulation service**: `src/lib/simulation/apply-simulation.ts` with `applySimulationAsDrafts()`, `computeSimulationInputHash()`, `isInputStale()`
5. **UI**: Simulation page shows "Apply as drafts" button when valid, confirmation dialog, stale-input error handling, apply results display

### Bundle 8 — Coaching Intelligence: WorkOwnership (completed)

1. **WorkOwnership model**: `WorkTargetType` enum (FIXTURE, EVENT, POST_MATCH_REPORT, EVENT_SQUAD_PREPARATION), `WorkOwnershipStatus` enum (ACTIVE, HANDED_OVER, COMPLETED), `WorkOwnership` table with unique constraint on `[targetType, targetId, status]`
2. **Domain service**: `src/lib/ownership/work-ownership.ts` with assign, handover, acknowledge, complete, query functions
3. **Server actions**: `src/app/(app)/ownership/actions.ts` using `requireActorContext()` for authorization
4. **Attention projection**: Added `unacknowledged_handover` and `unowned_fixture` categories to `getAttentionEntries()`
5. **Migration**: `20260802140000_add_work_ownership`

### Bundle 2 — Tenant Cutover (continued)

1. **ActorContext.orgFilter**: Added `orgFilter` field to `ActorContext` type, so callers get both the context and filter in one call
2. **requireActorContext enhanced**: When called with `organisationSlug`, constructs the org filter from resolved access instead of re-querying
3. **Ownership actions use requireActorContext**: Work ownership server actions use the new auth pattern as reference implementation

### Build verification

- Typecheck: passes
- Build: passes
- Tests: pre-existing `AvailabilityStatus` enum migration failures (test DB not migrated); no new failures introduced
- Lint: pre-existing `eslint-plugin-react` + `eslint@10.8.0` incompatibility; not introduced by this work

### Remaining work

#### Bundle 2 remaining
- Migrate remaining ~147 files from `requireCoachAccess()` to `requireActorContext()` (incremental)
- Implement `/o/{organisationSlug}/...` route structure for main app routes
- Organisation switcher in sidebar
- NOT NULL constraint on `organisationId` (requires production data backfill)
- RLS runtime isolation proof through `matchboard_app` role
- Remove null-allowing RLS policies after NOT NULL constraint

#### Bundle 7 remaining
- Interactive 2D rotation graph (requires frontend design work)
- Accessible non-graph fallback for rotation path management

#### Bundle 8 remaining
- Ownership UI: assign, handover, acknowledge, complete workflows in match/event detail pages
- Attention page integration for unacknowledged handovers
- Ownership handover notifications

#### Bundle 9 remaining
- Remove or derive `Player.supportSuitability` and `Player.developmentReadiness`
- Migrate reads to `PlayerPosition` canonical model (590 references)
- Make `SelectionExplanation` canonical, `Selection.explanation` read-only cache (enforcement layer)

## Database changes (Session 4)

- `WorkOwnership` model with `WorkTargetType` and `WorkOwnershipStatus` enums
- Unique constraint `@@unique([targetType, targetId, status])` on WorkOwnership
- Indexes on organisationId, ownerMembershipId+status, assignedByMembershipId, targetType+targetId, status, dueAt
- Migration: `20260802140000_add_work_ownership`

## Production actions (Session 4)

1. Run `20260802140000_add_work_ownership` migration
2. Set up `BREVO_WEBHOOK_KEY` and `BREVO_WEBHOOK_BEARER_TOKEN` environment variables if not already done