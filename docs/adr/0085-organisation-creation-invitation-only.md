# ADR-0085: Organisation creation is invitation-only, not self-service

## Status

Accepted

## Date

2026-08-22

## Context

`/organisations` (`src/app/(app)/organisations/page.tsx`) is the page any signed-in user
without a resolvable organisation lands on. It previously rendered a `CreateOrganisationForm`
whenever the current user had zero organisation memberships, wired to
`createOrganisationAction` (`src/app/(app)/organisations/actions.ts`). That action's only
authorization check was `requireCoachAccess()` — which only requires being an authenticated
user, not any specific role or pre-existing relationship to an organisation.

In practice this meant any Google account, on its first sign-in, could self-service create a
brand-new Matchboard tenant and become its OWNER, with no invitation, no maintainer
involvement, and no gate of any kind. This was flagged during the `platform-integrity-programme`
audit of Phase 11 (MultipleMembershipsError UX) — while scoping a minimal UI for the
zero/multiple-membership case, the maintainer confirmed this was not an intentional product
capability: Matchboard is meant to be invitation-only, with organisation provisioning handled
by the maintainer/backend team, not by whoever happens to authenticate.

This is a real authorization-model finding, not a cosmetic UX gap — `requireCoachAccess()`
alone is deny-by-default for *tenant-scoped* operations, but organisation *creation* is a
tenant-*bootstrapping* operation with no tenant context to check against yet, so the usual
per-tenant authorization model doesn't apply to it at all. The only thing standing between
"authenticated" and "owns a new tenant" was the presence of a UI button.

## Decision

Organisation creation is invitation-only. There is no self-service "create organisation" path
anywhere in the application:

- `createOrganisationAction` and `CreateOrganisationForm` are removed entirely, not merely
  hidden — an unreachable-from-the-UI action is still a callable server action and therefore
  still real attack surface (AGENTS.md: "UI-only protection is insufficient — hiding buttons
  is not authorization").
- `/organisations`'s empty state (no memberships) now only explains that Matchboard is
  invitation-only and directs the user to ask an administrator — no create action of any kind.
- New organisations are provisioned exclusively via `scripts/bootstrap-organisation.ts`, run
  by the maintainer/backend team directly against the database. This script already existed
  (originally framed as a one-time "bootstrap the first org" tool) and is now the standing,
  repeatable mechanism for onboarding every new organisation, not just the first. It requires
  the intended owner to already have a `User` row (i.e. have signed in via Google OAuth at
  least once) and is idempotent per slug.
- Organisation-creation audit logging (`logOrganisationCreate`) is preserved by wiring it into
  the bootstrap script instead of the removed server action, so provisioning a new org is
  still an audited event.

This is deliberately framed as "for now" — a future admin panel or a more structured
provisioning workflow (e.g. a machine-principal-authenticated API) remains open for later, but
requires its own explicit decision, not a default reversion to self-service creation.

## Consequences

- Closes a real, previously-unauthorized tenant-bootstrapping path with no code complexity
  added — this is a deletion, not a new access-control mechanism to maintain.
- New organisation onboarding now requires the maintainer/backend team to run a script rather
  than a customer self-serving instantly. This is an explicit, accepted tradeoff for an
  invitation-only product, not an oversight.
- `generateOrganisationSlug` (`src/lib/organisations/organisation-domain.ts`) is no longer
  called from `actions.ts` but remains defined there as a general-purpose utility a future
  admin tool could reuse — not removed, since it isn't dead application logic, just currently
  unused from the app layer.
- No existing test depended on the removed action or form (verified: only the domain function
  `createOrganisation()` and raw `db.organisation.create()` are used in test fixture setup,
  never the server action) — no test changes were required.
