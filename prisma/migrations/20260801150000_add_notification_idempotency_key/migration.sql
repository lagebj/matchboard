-- Add idempotency key to NotificationOutbox for deduplication
ALTER TABLE "NotificationOutbox" ADD COLUMN "idempotencyKey" TEXT;

-- Create unique index on idempotencyKey
CREATE UNIQUE INDEX "NotificationOutbox_idempotencyKey_key" ON "NotificationOutbox"("idempotencyKey");