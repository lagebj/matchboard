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

## Live verification outcome

Run against the deployed Test environment after this change merged, using
`scripts/verify-invitation-email-flow.ts` (`swamp verify-invitation-email-flow`):

**Confirmed, via `getTransacEmailsList`**: a real invitation created through the actual UI
produced a real Brevo dispatch (`events: [{name: "sent", ...}]`), with subject
`[TEST] owner-a invited you to join Matchboard Test Club on Matchboard` and tags
`["ORGANISATION_INVITATION", "<orgId>", "test", "invited-test@test-agent.matchboard.football"]` —
exactly the prefix and four correlation values this ADR added, verified against Brevo's own API,
not just the local `outbox.test.ts` mocks.

**Not confirmed, and not fixable from this ADR's scope**: the programme §29 flow's remaining
steps — extract the accept URL from actual content, authenticate as the dynamic invitee, accept,
verify access. `getTransacEmailContent` returned `"Mail content not available"` for this message,
persistently (retried over ~2 minutes, ruling out propagation delay). Root cause: the message
soft-bounced within 3 seconds of sending (`events: [..., {name: "soft_bounce", ...}]`) —
`invited-test@test-agent.matchboard.football` is a synthetic address with no real mailbox behind
it, by design (`BREVO_TEST_RECIPIENTS` only needs a syntactically valid, controlled address for
the *send* side). Brevo does not retain retrievable content for bounced messages. Presented to the
user as a choice — supply a real, deliverable inbox to complete the remaining steps, or accept
this partial result — and the decision was to accept the partial result rather than involve a real
mailbox. `scripts/verify-invitation-email-flow.ts` documents this limitation and supports an
`INVITEE_EMAIL` override (paired with adding that address to `BREVO_TEST_RECIPIENTS`) for anyone
who later wants to complete the full flow.

Two genuine script bugs were found and fixed by this same live run, unrelated to the content
limitation above: the Brevo message-list correlation poll window (15 attempts × 2s = 30s) was too
short — the actual send succeeded well within that window, but `getTransacEmailsList` took
noticeably longer to index it, confirmed by a manual query succeeding once the script's own
polling had already given up; and the script didn't handle a repeatable re-run against the same
recipient, since the app correctly rejects a duplicate pending invitation with "An active
invitation already exists," which the script needs to treat as "proceed with the existing
invitation," not a failure.

## Related decisions

- ADR-0043 — Brevo transactional email subsystem (no conflicting subject/tag convention existed).
- `PROGRAMME.md` §29-32 — the email architecture and Brevo-correlation requirements this closes.

## History

- 2026-08-20: Accepted and implemented, ahead of the first live Phase 4 invitation-email
  verification against the deployed Test environment.
- 2026-08-20 (later): Live-verified — see "Live verification outcome" above. Subject prefix and
  correlation tags fully confirmed via Brevo's own API. Accept-URL-extraction and accept-flow
  steps remain unverified with the default synthetic recipient, by deliberate user choice, not
  because of any remaining bug.
