# ADR-0078: Playwright mutation and expected-authorization-failure coverage

## Status

Accepted

## Date

2026-08-20

## Context

ADR-0069 shipped Layer 2 (Playwright, in `e2e/`) with smoke + accessibility coverage only,
explicitly deferring two items as follow-up:

- Mutation/persistence flows (creating a team, generating a round, finalizing selections).
- Expected-authorization-failure specs (a restricted-role persona attempting a blocked action
  and getting denied).

`docs/development/browser-acceptance-testing.md` flagged both as "Not yet implemented," not
silently missing. This ADR closes that follow-up.

Two things changed since ADR-0069 that shape the design:

1. **Phase 3's per-PR acceptance pipeline (ADR-0075)** now deploys every PR's exact commit to an
   isolated Neon child branch and aliases the shared `test.matchboard.football` slot to it for
   the duration of that PR's CI run. `test-acceptance.yml`'s `npm run test:e2e` step therefore
   already runs against a disposable, PR-scoped database in CI — mutations there are consequence-
   free (the branch is deleted on PR close). Only **local** `npm run test:e2e` runs (default
   `baseURL: https://test.matchboard.football`) still hit the shared, persistent `test` branch
   that ADR-0069's "Consequences" section already called out as a future constraint.
2. Investigating the codebase's actual role-check and cross-org-access behavior (not assumed)
   surfaced two real, load-bearing facts used directly in the new specs' assertions:
   - `requireMutationRole(ctx)` is called before the enclosing `try/catch` at all 51 of its call
     sites across the app's server actions (confirmed by grep, not sampled) — an authorization
     failure is a deliberate, consistent, uncaught throw that surfaces via the app's generic
     `src/app/(app)/error.tsx` boundary ("Something went wrong"), never a friendly inline
     redirect. This is the app's real, intentional behavior everywhere, not a bug isolated to
     the one action the new spec exercises — so the new spec asserts *that* behavior rather than
     "fixing" it into a special case.
   - `/o/{orgSlug}/teams/new` has no page-level role gate of its own; a VIEWER-role user can
     view the full create-team form. The only enforcement point is inside `createTeamAction`
     itself. The new spec proves denial at the point that actually matters — no team persisted —
     not merely that a button was hidden (UI-only gating is explicitly insufficient per this
     repo's auth rules).
   - There is currently no UI-driven way to delete or archive a team (`deleteTeamAction` exists
     in `src/app/(app)/teams/actions.ts` but no component calls it). This is why the mutation-
     flow spec below does not create a team — doing so against the shared local Test slot would
     leave permanent, uncleanable residue. Recorded as a real, if minor, product gap in
     `docs/development/browser-acceptance-testing.md`, not fixed here — building team-deletion UI
     is out of scope for a test-coverage change.

## Decision

Add three things to `e2e/`, all under the existing Layer 2 model (no new dependencies, no CI
model change beyond what already exists):

1. **`e2e/auth.setup.ts` gains a second persona.** Refactored into a shared
   `authenticateAndSaveState()` helper, now producing two storage states:
   `e2e/.auth/coach.json` (`coach-all-a`, unchanged) and `e2e/.auth/viewer.json` (`viewer-a` — a
   real VIEWER-role, Org-A-only persona already present in the canonical seed dataset). No new
   persona needed adding to the seed script.
2. **`e2e/authz-failure.spec.ts`**, run under a new `chromium-viewer` Playwright project
   (`playwright.config.ts`) using `viewer.json`:
   - VIEWER attempts to create a team via the real form → asserts the generic error boundary
     appears **and** re-navigates to `/teams` to confirm no team with the attempted (uniquely
     tagged) name was persisted. Proves server-side denial, not just a UI symptom.
   - `viewer-a` (Org A only) loads `/o/test-club-b/assistant` (Org B) → asserts the same error
     boundary and that no Org B team name (`B1 Lions`, `B1 Wolves`) ever rendered.
   The default `chromium` project gets `testIgnore: /authz-failure\.spec\.ts/` so it never runs
   under the full-access coach persona, where the "denied" assertions would be false.
3. **`e2e/round-mutation.spec.ts`**, run under the existing `chromium` project (`coach-all-a`):
   generates real draft selections for round A1 W11 (`/o/{orgSlug}/rounds`'s per-round
   "Generate squads" button — the only precise, single-round generation control; the Fixtures
   page's per-round action is navigation-only and its bulk button generates every not-generated
   round in the period), verifies at least one persisted player chip on the Round Board, then
   clears it back to not-generated via the board's existing "Clear round draft" confirmation
   dialog. **Deliberately self-cleaning** — this is what makes it safe to run repeatedly against
   the shared persistent Test slot locally, not only against CI's disposable per-PR branch. Round
   A1 W11 is identified by its unique team-name pair ("A1 Blues" + "A1 Whites", with no third
   team) rather than a hardcoded round ID, since seed-generated IDs aren't stable across reseeds.

## Consequences

- Both new specs prove real server-side behavior (persistence and denial), not DOM-only
  assertions — consistent with this repo's "UI-only protection is insufficient" auth rule.
- The mutation spec's generate → verify → clear round-trip leaves the shared Test dataset in
  exactly its original state either way (success or mid-run failure just leaves the round in
  DRAFT, itself recoverable via the same "Clear round" control or `restore-test-baseline`).
- Team-creation mutation coverage remains deferred — recorded as a documented gap (no UI-driven
  team deletion exists yet), not silently missing, in
  `docs/development/browser-acceptance-testing.md`.
- Broader page coverage beyond what ADR-0069 and this ADR cover remains explicitly out of scope,
  same as before.
- No new CI job, dependency, or workflow change — `chromium-viewer` is a second Playwright
  project inside the existing `test:e2e` command and `e2e` CI job.
