---
type: ADR
id: "0043"
title: Use Brevo for transactional email with provider-neutral outbox
status: proposed
date: 2026-08-01
supersedes:
superseded_by:
tags: [email, notifications, infrastructure, security]
---

## Context

Matchboard needs to send transactional emails for domain events such as organisation invitations, review assignments, and future notification scenarios. There is no existing email, notification, outbox, or queue infrastructure.

Requirements:
- Deliver invitation and review emails reliably with retry and idempotency
- Support provider-neutral abstraction (Brevo today, replaceable later)
- Persist delivery state for audit and troubleshooting
- Process outbound email asynchronously (not blocking request cycles)
- Receive delivery status callbacks (delivered, bounced, opened) from the provider
- Integrate with existing audit logging and security patterns
- No new external dependencies beyond the Brevo SDK

Constraints:
- Vercel serverless runtime (no persistent worker processes)
- Neon PostgreSQL persistence layer
- Existing cron pattern available via Vercel Cron
- All mutations must use `requireCoachAccess()` or equivalent auth
- Organisation-scoped multi-tenancy via `organisationId`
- Player names and personal data must never be sent to external AI services

## Decision

### 1. Transactional outbox pattern with persisted delivery state

Use a database-backed transactional outbox. Domain actions write outbox entries in the same transaction as the domain mutation. A cron-triggered processor picks up pending entries and delivers them.

Models:
- `NotificationOutbox` — the outbox entry with template, payload, status, retry metadata
- `NotificationDelivery` — per-recipient delivery attempt tracking with provider message ID, status, and timestamps
- `ProviderWebhookEvent` — inbound webhook events from the email provider for delivery status updates

### 2. Provider-neutral email abstraction

Define a `TransactionalEmailProvider` interface with a single `send()` method returning a provider result. Implement:
- `BrevoEmailProvider` — production adapter using `@getbrevo/brevo` SDK
- `ConsoleEmailProvider` — development/test adapter that logs to console
- `FakeEmailProvider` — test adapter with in-memory capture

The outbox processor depends on the provider interface, not on Brevo directly.

### 3. Brevo as the initial provider

Use Brevo (formerly Sendinblue) for production transactional email delivery. Configuration via validated environment variables:
- `BREVO_API_KEY` — required in production
- `EMAIL_FROM_ADDRESS` — defaults to `notifications@matchboard.football`
- `EMAIL_FROM_NAME` — defaults to `Matchboard`
- `APP_BASE_URL` — required for generating links in email templates

When `BREVO_API_KEY` is absent, the system falls back to `ConsoleEmailProvider` (safe local development).

### 4. Templates as TypeScript functions

Email templates are pure TypeScript functions that return structured template data (subject, html, text). No template engine dependency. Templates are mapped by a string key stored in the outbox entry.

Initial templates:
- `organisation_invitation` — invitation to join an organisation

### 5. Outbox processor as Vercel Cron job

Add a `/api/cron/notification-outbox` endpoint that processes pending outbox entries with idempotency and retry with exponential backoff (max 5 attempts, max age 72 hours). Protected by `CRON_SECRET`. On Vercel Hobby plans, cron is limited to once daily (`0 6 * * *`); on Pro/Enterprise, the interval can be reduced to every 2 minutes for faster delivery.

### 6. Webhook endpoint for delivery status

Add a `/api/webhooks/brevo` endpoint that receives Brevo webhook events and updates `NotificationDelivery` status. Validates the Brevo signature header. Idempotent by event ID.

### 7. Domain integration via enqueue functions

Domain actions call `enqueueNotification()` within the same transaction as the domain mutation. This keeps email sending out of the request-response cycle while ensuring atomicity.

### 8. Security model

- Outbox entries are organisation-scoped (`organisationId`)
- Webhook endpoint uses Brevo signature verification, not coach auth
- Cron endpoint uses `CRON_SECRET` verification
- Email payloads contain minimal data (no player names, no sensitive coaching context)
- Provider API keys are server-only environment variables, never `NEXT_PUBLIC_*`
- Audit logging for email send attempts and delivery status changes

## Alternatives considered

1. **Direct send in request cycle** — blocks the request, no retry, no audit trail. Rejected because reliability and auditability are required.
2. **Message queue (SQS, Redis, Bull)** — adds infrastructure dependency, overkill for current volume, no existing queue in stack. Rejected for simplicity.
3. **In-process queue with Next.js middleware** — no persistence across serverless cold starts. Rejected for reliability.
4. **Provider-specific outbox (Brevo only)** — couples the system to Brevo's delivery model. Rejected for provider neutrality.
5. **Email template engine (Handlebars, MJML)** — adds dependency for what are currently simple templates. Can be added later if complexity grows.

## Consequences

- Positive: Reliable email delivery with retry, idempotency, and audit trail
- Positive: Provider-neutral abstraction allows switching from Brevo without changing domain logic
- Positive: Outbox pattern ensures domain mutations and email enqueueing are atomic
- Positive: Webhook integration provides real-time delivery status
- Negative: Additional database tables and a cron job to maintain
- Negative: Brevo webhook requires a public endpoint and signature verification
- Negative: Template changes require code deployment (acceptable for current low volume)
- Neutral: The outbox processor adds ~1-2 minute latency for email delivery (cron interval). For invitation emails, this is acceptable. If sub-second delivery becomes necessary, a push-based processor can be added later without changing the outbox model.

## Key files

| File | Purpose |
|------|---------|
| `src/lib/email/provider.ts` | `TransactionalEmailProvider` interface, `EmailProviderResult` type |
| `src/lib/email/brevo-provider.ts` | Brevo SDK adapter |
| `src/lib/email/console-provider.ts` | Console logging adapter for dev |
| `src/lib/email/fake-provider.ts` | In-memory test adapter |
| `src/lib/email/templates/index.ts` | Template registry and type definitions |
| `src/lib/email/templates/organisation-invitation.ts` | Organisation invitation template |
| `src/lib/email/outbox.ts` | `enqueueNotification()`, outbox processing, retry logic |
| `src/lib/email/outbox-processor.ts` | Cron-triggered outbox processor |
| `src/lib/email/webhook-handler.ts` | Brevo webhook signature verification and event processing |
| `src/app/api/cron/notification-outbox/route.ts` | Cron endpoint |
| `src/app/api/webhooks/brevo/route.ts` | Webhook endpoint |

## Migration notes

- Prisma migration adds `NotificationOutbox`, `NotificationDelivery`, `ProviderWebhookEvent` models and `NotificationStatus`, `NotificationTemplate`, `DeliveryStatus` enums
- No changes to existing models
- Brevo API key must be configured in Vercel environment variables before production use