# ADR-0076: `[TEST]` subject prefix and correlation tags for outbound Test email

## Status

Accepted

## Date

2026-08-20

## Context

Consolidation programme §32 ("Brevo correlation") requires: Test emails carry sufficient
correlation to identify environment, purpose, and recipient, using provider-supported
metadata/tags where appropriate; Test message subjects should clearly identify Test, e.g.
`[TEST]`. Auditing the current implementation (`src/lib/email/outbox.ts`,
`src/lib/email/templates/organisation-invitation.ts`) ahead of a live Phase 4 verification found
neither exists: subjects carry no environment marker, and the only Brevo tags sent are `template`
and `organisationId` (`outbox.ts`'s two send call sites, `processOutboxBatch` and
`sendNotificationNow`).

This gap blocks reliable message correlation for verification — without it, telling apart a real
Test-triggered email from anything else in the same Brevo account relies on recipient address and
timing alone.

ADR-0043 (Brevo transactional email subsystem) does not specify a subject-line format or tag
schema, so this doesn't supersede or conflict with anything already decided there.

## Decision

Add a single shared helper, `buildOutboundEmail()` in `outbox.ts`, used by both send call sites
(`processOutboxBatch`, `sendNotificationNow`) — one implementation, not duplicated per call site,
per this repo's "one business operation, one owning implementation" rule:

- **Subject**: prefixed with `[TEST] ` when `isTest()` (from `@/lib/env`) is true. Applies
  uniformly to every notification template, not just invitations — implemented centrally rather
  than per-template so a future template can't accidentally skip it.
- **Tags**: `template`, `organisationId` (already existed), plus new `environment`
  (`process.env.MATCHBOARD_ENV`) and `recipient` (primary recipient's email, enabling Brevo-side
  `getTransacEmailsList` filtering without a DB round-trip).

**Deliberately not added**: `PR` and `test run` tags, despite the programme text listing them.
This code runs from live application request handling (a coach creating an invitation, a cron
batch), not a CI job — there is no PR number or test-run identifier available to attach truthfully
at that point. Fabricating placeholder values would be worse than omitting them. The programme
text itself qualifies this with "where relevant" / "where appropriate."

This is an observability safeguard, matching the programme's own framing — not a security
boundary. `BREVO_TEST_RECIPIENTS`' fail-closed allowlist (`brevo-provider.ts`) remains the actual
control preventing Test from emailing real people; this ADR only makes an already-safe send
easier to find and verify after the fact.

## Consequences

- Every Test-environment outbound email is now visually distinguishable in an inbox or Brevo's
  dashboard, and programmatically filterable via tags — needed for the live invitation-email
  verification this change was written to unblock (see `CURRENT-WORK.md`/`JOURNAL.md` for that
  verification's outcome).
- No behavior change in Production, Development, or Staging — `isTest()` gates the prefix, and
  the new tags are additive (existing `template`/`organisationId` tags unchanged in shape).
- `src/lib/email/__tests__/outbox.test.ts` (new) covers both the conditional prefix and the tag
  shape via `FakeEmailProvider`, mocking only `isTest()` from `@/lib/env` (not the whole module —
  `provider.ts`/`provider-factory.ts` depend on other real exports from it) since `isTest()`
  reads a module-load-time-frozen constant, not live `process.env`, so tests can't flip it by
  mutating the environment mid-test.

## Related decisions

- ADR-0043 — Brevo transactional email subsystem (no conflicting subject/tag convention existed).
- `PROGRAMME.md` §29-32 — the email architecture and Brevo-correlation requirements this closes.

## History

- 2026-08-20: Accepted and implemented, ahead of the first live Phase 4 invitation-email
  verification against the deployed Test environment.
