-- MT-1: Add Organisation, OrganizationMembership, OrganisationInvitation, TeamAccess, MachinePrincipal
-- Also adds nullable organisationId to Team and updates unique constraint.
-- Per ADR-0035: shared-schema multi-tenancy, organisation is the hard tenant boundary.

-- Create enums
CREATE TYPE "OrganisationRole" AS ENUM ('OWNER', 'ADMIN', 'COACH', 'VIEWER');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "MachinePrincipalStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- Create Organisation table
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");
CREATE INDEX "Organisation_slug_idx" ON "Organisation"("slug");
CREATE INDEX "Organisation_name_idx" ON "Organisation"("name");

-- Create OrganisationMembership table
CREATE TABLE "OrganisationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "role" "OrganisationRole" NOT NULL DEFAULT 'COACH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganisationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganisationMembership_userId_organisationId_key" ON "OrganisationMembership"("userId", "organisationId");
CREATE INDEX "OrganisationMembership_organisationId_idx" ON "OrganisationMembership"("organisationId");
CREATE INDEX "OrganisationMembership_userId_idx" ON "OrganisationMembership"("userId");
CREATE INDEX "OrganisationMembership_role_idx" ON "OrganisationMembership"("role");

ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create OrganisationInvitation table
CREATE TABLE "OrganisationInvitation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "intendedRole" "OrganisationRole" NOT NULL DEFAULT 'COACH',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    CONSTRAINT "OrganisationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganisationInvitation_token_key" ON "OrganisationInvitation"("token");
CREATE INDEX "OrganisationInvitation_organisationId_idx" ON "OrganisationInvitation"("organisationId");
CREATE INDEX "OrganisationInvitation_invitedEmail_idx" ON "OrganisationInvitation"("invitedEmail");
CREATE INDEX "OrganisationInvitation_expiresAt_idx" ON "OrganisationInvitation"("expiresAt");
CREATE UNIQUE INDEX "OrganisationInvitation_organisationId_invitedEmail_status_key" ON "OrganisationInvitation"("organisationId", "invitedEmail", "status");

ALTER TABLE "OrganisationInvitation" ADD CONSTRAINT "OrganisationInvitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganisationInvitation" ADD CONSTRAINT "OrganisationInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create TeamAccess table
CREATE TABLE "TeamAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamAccess_membershipId_teamId_key" ON "TeamAccess"("membershipId", "teamId");
CREATE INDEX "TeamAccess_teamId_idx" ON "TeamAccess"("teamId");
CREATE INDEX "TeamAccess_membershipId_idx" ON "TeamAccess"("membershipId");

ALTER TABLE "TeamAccess" ADD CONSTRAINT "TeamAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganisationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamAccess" ADD CONSTRAINT "TeamAccess_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create MachinePrincipal table
CREATE TABLE "MachinePrincipal" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MachinePrincipalStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientCredentialHash" TEXT,
    "clientCredentialPrefix" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MachinePrincipal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MachinePrincipal_organisationId_idx" ON "MachinePrincipal"("organisationId");
CREATE INDEX "MachinePrincipal_status_idx" ON "MachinePrincipal"("status");
CREATE INDEX "MachinePrincipal_clientCredentialPrefix_idx" ON "MachinePrincipal"("clientCredentialPrefix");

ALTER TABLE "MachinePrincipal" ADD CONSTRAINT "MachinePrincipal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable organisationId to Team (MT-2 will make NOT NULL after data migration)
ALTER TABLE "Team" ADD COLUMN "organisationId" TEXT;

-- Add composite unique index on Team(organisationId, name)
-- Note: This allows multiple teams with the same name in different organisations
CREATE UNIQUE INDEX "Team_organisationId_name_key" ON "Team"("organisationId", "name");

-- Add foreign key from Team to Organisation
ALTER TABLE "Team" ADD CONSTRAINT "Team_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index on Team.organisationId
CREATE INDEX "Team_organisationId_idx" ON "Team"("organisationId");

-- Update User model relations (Prisma will handle the reverse relation fields)
-- No schema changes needed for User table; Prisma manages the relation via OrganisationMembership and OrganisationInvitation