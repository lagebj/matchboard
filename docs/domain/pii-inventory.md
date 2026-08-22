# Personal Data Inventory

Matchboard handles personal data for youth football players and the coaches who use the
app. This document inventories what is stored, where, and what retention/deletion
capability exists — the durable reference AGENTS.md's coach-facing/parent-facing language
boundaries assume but don't themselves catalogue.

This is an inventory, not a policy document — it records current fact. Product/legal
decisions about retention periods or a formal deletion process belong in an ADR if/when
they're made; this doc should be updated whenever the schema or handling changes.

## Player data (minors)

| Field | Model | Sensitivity | Notes |
|---|---|---|---|
| `firstName`, `lastName` | `Player` | Identifying | Required (`lastName` optional). Never sent to external AI services (AGENTS.md) — stable player IDs used instead. |
| `shirtNumber` | `Player` | Low | Squad administration only. |
| Position/attribute ratings (`primaryPosition`, `ballControl`, etc.) | `Player` | Coach-facing only | Never appear in parent-facing exports (AGENTS.md's "Player attribute ratings" rules). Not identifying on their own. |
| `currentAvailability` | `Player` | Low | Operational status, not sensitive. |

**Deliberately never collected** (AGENTS.md, enforced by product design, not just policy):
date of birth, home address, parent/guardian contact details, medical information, photos.
`docs/domain` and `AGENTS.md`'s "Opponent teams" section explicitly forbid designed fields
for identifying details about individuals beyond what's listed above.

**Retention/deletion**: `Player.removedAt` is a soft-delete timestamp — removed players are
excluded from active queries but the row (including name) persists indefinitely. There is
no hard-delete or data-export-on-request capability for player records today. This is a
real gap if a parent/guardian ever asks for player data to be fully erased — flagged here,
not yet a resolved capability.

## Coach/user data (adults)

| Field | Model | Sensitivity | Notes |
|---|---|---|---|
| `email` | `User` | Identifying | From Google OAuth. Unique, used as the invitation-matching key. |
| `name`, `image` (avatar) | `User` | Identifying | From Google OAuth profile, not separately collected. |
| OAuth tokens (`access_token`, `refresh_token`, `id_token`) | `Account` | Sensitive credential-adjacent | Managed entirely by Auth.js/NextAuth; never logged (AGENTS.md: "Secrets never enter Git, logs, fixtures, reports"). |
| `invitedEmail` | `OrganisationInvitation` | Identifying | The email an invitation was sent to; may not yet correspond to a `User` row. |

**Retention/deletion**: no application-level user-deletion action exists (verified: no code
path calls `db.user.delete()` outside the raw Prisma client itself). A coach who stops using
Matchboard has their `User`/`Account`/`Session` rows persist indefinitely, and their
`OrganisationMembership` rows persist even after suspension (see `Organisation.suspendedAt`
model — suspension is not deletion). Same gap as above: no self-service or admin-triggered
"delete my account" flow exists today.

## Where personal data can leave the process

- **Transactional email** (`src/lib/email/`): invitation emails go to `invitedEmail` via
  Brevo (production) or console logging (dev). `BREVO_TEST_RECIPIENTS` restricts non-production
  sends (AGENTS.md/ADR references in the email section).
  This is a required message.
- **External AI payloads**: player names and personal data are explicitly excluded — stable
  player IDs are used instead, and payloads are sanitized centrally (AGENTS.md, "Coach-facing
  vs parent-facing language").
- **Exports** (season export, `/api/season/export`): coach-mode export includes player
  names; parent-mode export hides internal planning tags but still includes player names and
  results (this is the intended purpose of a parent-facing roster/results export, not a leak).
- **Audit logs** (`src/lib/security/audit-log.ts`): log actor emails and resource IDs, not
  full player/session records — "Audit logs exclude sensitive payloads" (AGENTS.md).

## Known gaps (not yet resolved)

- No hard-delete or data-export-on-request path for a `Player` row.
- No hard-delete or data-export-on-request path for a `User` row.
- No documented retention period for soft-deleted (`removedAt`) player data — it persists
  indefinitely today.

These are recorded here as known facts, not assigned a remediation timeline — closing them
requires a product/legal decision (what does "delete on request" actually need to satisfy)
that belongs in an ADR, not a default implementation guess.
