-- MT-6: Add suspension fields to Organisation model
-- Per MT-6 spec: organisations can be suspended (blocking all member access) and reactivated
-- Suspension is reversible; deletion is a separate irreversible workflow

ALTER TABLE "Organisation" ADD COLUMN "suspendedAt" TIMESTAMP;
ALTER TABLE "Organisation" ADD COLUMN "suspendedReason" TEXT;

CREATE INDEX "Organisation_suspendedAt_idx" ON "Organisation"("suspendedAt") WHERE "suspendedAt" IS NOT NULL;