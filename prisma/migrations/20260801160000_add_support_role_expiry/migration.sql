-- Add expiresAt to OrganisationMembership for time-bound SUPPORT access
ALTER TABLE "OrganisationMembership" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Index for querying expired memberships
CREATE INDEX "OrganisationMembership_expiresAt_idx" ON "OrganisationMembership"("expiresAt");