-- CreateEnum
CREATE TYPE "MovementCandidateRole" AS ENUM ('SUPPORT', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "MovementCandidateStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "MovementCandidateRationale" AS ENUM ('CHALLENGE_EXPOSURE', 'CONFIDENCE_AND_INVOLVEMENT', 'STABILISE_TEAM_FUNCTION', 'SUPPORT_TEAMMATES', 'POSITIONAL_LEARNING', 'RESET_AND_RESPONSIBILITY', 'COACH_JUDGEMENT');

-- CreateTable
CREATE TABLE "MovementCandidate" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rotationPathId" TEXT NOT NULL,
    "role" "MovementCandidateRole" NOT NULL,
    "status" "MovementCandidateStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewBy" TIMESTAMP(3),
    "rationaleCategory" "MovementCandidateRationale" NOT NULL,
    "rationaleNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovementCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovementCandidate_playerId_idx" ON "MovementCandidate"("playerId");

-- CreateIndex
CREATE INDEX "MovementCandidate_rotationPathId_idx" ON "MovementCandidate"("rotationPathId");

-- CreateIndex
CREATE INDEX "MovementCandidate_status_idx" ON "MovementCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MovementCandidate_playerId_rotationPathId_role_key" ON "MovementCandidate"("playerId", "rotationPathId", "role");

-- AddForeignKey
ALTER TABLE "MovementCandidate" ADD CONSTRAINT "MovementCandidate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementCandidate" ADD CONSTRAINT "MovementCandidate_rotationPathId_fkey" FOREIGN KEY ("rotationPathId") REFERENCES "RotationPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
