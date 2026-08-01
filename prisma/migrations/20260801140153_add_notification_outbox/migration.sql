-- Transactional email outbox models (ADR-0043)
-- NotificationOutbox, NotificationDelivery, ProviderWebhookEvent

-- Create enums
CREATE TYPE "NotificationTemplate" AS ENUM ('ORGANISATION_INVITATION');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'OPENED', 'CLICKED', 'FAILED');

-- Create NotificationOutbox table
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "template" "NotificationTemplate" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- Create NotificationDelivery table
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "outboxId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "providerMessageId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "statusDetail" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bouncedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- Create ProviderWebhookEvent table
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'brevo',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "recipientEmail" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for NotificationDelivery -> NotificationOutbox
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "NotificationOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for NotificationOutbox
CREATE INDEX "NotificationOutbox_status_scheduledAt_idx" ON "NotificationOutbox"("status", "scheduledAt");
CREATE INDEX "NotificationOutbox_status_nextRetryAt_idx" ON "NotificationOutbox"("status", "nextRetryAt");
CREATE INDEX "NotificationOutbox_organisationId_idx" ON "NotificationOutbox"("organisationId");
CREATE INDEX "NotificationOutbox_template_idx" ON "NotificationOutbox"("template");

-- Create indexes for NotificationDelivery
CREATE INDEX "NotificationDelivery_outboxId_idx" ON "NotificationDelivery"("outboxId");
CREATE INDEX "NotificationDelivery_recipientEmail_idx" ON "NotificationDelivery"("recipientEmail");
CREATE INDEX "NotificationDelivery_recipientUserId_idx" ON "NotificationDelivery"("recipientUserId");
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");
CREATE INDEX "NotificationDelivery_providerMessageId_idx" ON "NotificationDelivery"("providerMessageId");

-- Create indexes for ProviderWebhookEvent
CREATE INDEX "ProviderWebhookEvent_provider_eventType_idx" ON "ProviderWebhookEvent"("provider", "eventType");
CREATE INDEX "ProviderWebhookEvent_providerMessageId_idx" ON "ProviderWebhookEvent"("providerMessageId");
CREATE INDEX "ProviderWebhookEvent_processed_receivedAt_idx" ON "ProviderWebhookEvent"("processed", "receivedAt");
CREATE UNIQUE INDEX "ProviderWebhookEvent_eventId_key" ON "ProviderWebhookEvent"("eventId");