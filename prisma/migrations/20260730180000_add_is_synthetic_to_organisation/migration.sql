-- MT-4: Add isSynthetic flag to Organisation model
-- Per ADR-0038: Synthetic organisations are for automation only, containing fake data
-- Normal users cannot join or discover synthetic organisations

ALTER TABLE "Organisation" ADD COLUMN "isSynthetic" BOOLEAN NOT NULL DEFAULT false;

-- Index for querying synthetic organisations
CREATE INDEX "Organisation_isSynthetic_idx" ON "Organisation"("isSynthetic");