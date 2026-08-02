-- Add idempotencyKey to NotificationOutbox for deduplication
ALTER TABLE "NotificationOutbox" ADD COLUMN "idempotencyKey" TEXT;

-- Create unique index on idempotencyKey (nulls are not constrained)
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationOutbox_idempotencyKey_key" ON "NotificationOutbox"("idempotencyKey");