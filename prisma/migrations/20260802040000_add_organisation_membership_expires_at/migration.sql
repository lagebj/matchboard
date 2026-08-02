-- Add expiresAt to OrganisationMembership for membership expiry
ALTER TABLE "OrganisationMembership" ADD COLUMN "expiresAt" TIMESTAMP(3);