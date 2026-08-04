-- MT-7: Add FootballGroup schema foundation
-- Per ADR-0049: Football Group as Operational Boundary
-- This migration adds new models (FootballGroup, GroupAccess, FootballGroupPlayer, GroupMovementPath)
-- and nullable footballGroupId on existing models (Team, Event, LeagueSeason, RuleConfig).
-- All new fields are nullable/side-tables to maintain backward compatibility during the foundation phase.

-- ============================================================
-- 1. Create enums
-- ============================================================

CREATE TYPE "FootballGroupType" AS ENUM ('AGE_GROUP', 'GENDER_GROUP', 'COMPETITIVE_GROUP', 'CUSTOM');
CREATE TYPE "GroupMembershipType" AS ENUM ('PRIMARY', 'SECONDARY', 'TEMPORARY');
CREATE TYPE "GroupMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED');
CREATE TYPE "GroupAccessRole" AS ENUM ('GROUP_COACH', 'GROUP_VIEWER');
CREATE TYPE "GroupMovementPathRole" AS ENUM ('SUPPORT', 'DEVELOPMENT', 'CONFIDENCE_REBUILD', 'BACKFILL');
CREATE TYPE "GroupMovementPathScope" AS ENUM ('MATCH', 'EVENT');

-- ============================================================
-- 2. Create FootballGroup table
-- ============================================================

CREATE TABLE "FootballGroup" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "FootballGroupType" NOT NULL DEFAULT 'AGE_GROUP',
    "cohortYear" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FootballGroup_organisationId_slug_key" ON "FootballGroup"("organisationId", "slug");
CREATE INDEX "FootballGroup_organisationId_idx" ON "FootballGroup"("organisationId");
CREATE INDEX "FootballGroup_isActive_idx" ON "FootballGroup"("isActive");
CREATE INDEX "FootballGroup_cohortYear_idx" ON "FootballGroup"("cohortYear");

ALTER TABLE "FootballGroup"
    ADD CONSTRAINT "FootballGroup_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. Create GroupAccess table
-- ============================================================

CREATE TABLE "GroupAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "footballGroupId" TEXT NOT NULL,
    "role" "GroupAccessRole" NOT NULL DEFAULT 'GROUP_COACH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupAccess_membershipId_footballGroupId_key" ON "GroupAccess"("membershipId", "footballGroupId");
CREATE INDEX "GroupAccess_footballGroupId_idx" ON "GroupAccess"("footballGroupId");
CREATE INDEX "GroupAccess_membershipId_idx" ON "GroupAccess"("membershipId");
CREATE INDEX "GroupAccess_role_idx" ON "GroupAccess"("role");

ALTER TABLE "GroupAccess"
    ADD CONSTRAINT "GroupAccess_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "OrganisationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupAccess"
    ADD CONSTRAINT "GroupAccess_footballGroupId_fkey"
    FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. Create FootballGroupPlayer table
-- ============================================================

CREATE TABLE "FootballGroupPlayer" (
    "id" TEXT NOT NULL,
    "footballGroupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "membershipType" "GroupMembershipType" NOT NULL DEFAULT 'PRIMARY',
    "status" "GroupMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "coreTeamId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "transferredToGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballGroupPlayer_pkey" PRIMARY KEY ("id")
);

-- Partial unique index: one active primary membership per player per group
CREATE UNIQUE INDEX "FootballGroupPlayer_active_primary_unique"
    ON "FootballGroupPlayer"("footballGroupId", "playerId", "membershipType")
    WHERE "status" = 'ACTIVE' AND "membershipType" = 'PRIMARY';

CREATE INDEX "FootballGroupPlayer_footballGroupId_idx" ON "FootballGroupPlayer"("footballGroupId");
CREATE INDEX "FootballGroupPlayer_playerId_idx" ON "FootballGroupPlayer"("playerId");
CREATE INDEX "FootballGroupPlayer_organisationId_idx" ON "FootballGroupPlayer"("organisationId");
CREATE INDEX "FootballGroupPlayer_status_idx" ON "FootballGroupPlayer"("status");
CREATE INDEX "FootballGroupPlayer_coreTeamId_idx" ON "FootballGroupPlayer"("coreTeamId");

ALTER TABLE "FootballGroupPlayer"
    ADD CONSTRAINT "FootballGroupPlayer_footballGroupId_fkey"
    FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FootballGroupPlayer"
    ADD CONSTRAINT "FootballGroupPlayer_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FootballGroupPlayer"
    ADD CONSTRAINT "FootballGroupPlayer_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FootballGroupPlayer"
    ADD CONSTRAINT "FootballGroupPlayer_coreTeamId_fkey"
    FOREIGN KEY ("coreTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FootballGroupPlayer"
    ADD CONSTRAINT "FootballGroupPlayer_transferredToGroupId_fkey"
    FOREIGN KEY ("transferredToGroupId") REFERENCES "FootballGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. Create GroupMovementPath table
-- ============================================================

CREATE TABLE "GroupMovementPath" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "fromGroupId" TEXT NOT NULL,
    "toGroupId" TEXT NOT NULL,
    "role" "GroupMovementPathRole" NOT NULL,
    "scope" "GroupMovementPathScope" NOT NULL DEFAULT 'MATCH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMovementPath_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupMovementPath_organisationId_fromGroupId_toGroupId_role_scope_key"
    ON "GroupMovementPath"("organisationId", "fromGroupId", "toGroupId", "role", "scope");
CREATE INDEX "GroupMovementPath_organisationId_idx" ON "GroupMovementPath"("organisationId");
CREATE INDEX "GroupMovementPath_fromGroupId_idx" ON "GroupMovementPath"("fromGroupId");
CREATE INDEX "GroupMovementPath_toGroupId_idx" ON "GroupMovementPath"("toGroupId");
CREATE INDEX "GroupMovementPath_isActive_idx" ON "GroupMovementPath"("isActive");

ALTER TABLE "GroupMovementPath"
    ADD CONSTRAINT "GroupMovementPath_fromGroupId_fkey"
    FOREIGN KEY ("fromGroupId") REFERENCES "FootballGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMovementPath"
    ADD CONSTRAINT "GroupMovementPath_toGroupId_fkey"
    FOREIGN KEY ("toGroupId") REFERENCES "FootballGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMovementPath"
    ADD CONSTRAINT "GroupMovementPath_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 6. Add nullable footballGroupId to existing models
-- ============================================================

ALTER TABLE "Team" ADD COLUMN "footballGroupId" TEXT;
ALTER TABLE "Event" ADD COLUMN "footballGroupId" TEXT;
ALTER TABLE "LeagueSeason" ADD COLUMN "footballGroupId" TEXT;
ALTER TABLE "RuleConfig" ADD COLUMN "footballGroupId" TEXT;

-- Foreign keys for nullable footballGroupId
ALTER TABLE "Team"
    ADD CONSTRAINT "Team_footballGroupId_fkey"
    FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
    ADD CONSTRAINT "Event_footballGroupId_fkey"
    FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeagueSeason"
    ADD CONSTRAINT "LeagueSeason_footballGroupId_fkey"
    FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RuleConfig"
    ADD CONSTRAINT "RuleConfig_footballGroupId_fkey"
    FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for nullable footballGroupId
CREATE INDEX "Team_footballGroupId_idx" ON "Team"("footballGroupId");
CREATE INDEX "Event_footballGroupId_idx" ON "Event"("footballGroupId");
CREATE INDEX "LeagueSeason_footballGroupId_idx" ON "LeagueSeason"("footballGroupId");
CREATE INDEX "RuleConfig_footballGroupId_idx" ON "RuleConfig"("footballGroupId");