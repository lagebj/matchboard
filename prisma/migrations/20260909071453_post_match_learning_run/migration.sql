-- CreateEnum
CREATE TYPE "PostMatchLearningTrigger" AS ENUM ('REPORT_COMPLETION', 'REPLAY', 'RECONCILE');

-- CreateEnum
CREATE TYPE "LearningRunOutcome" AS ENUM ('APPLIED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "PostMatchLearningRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT,
    "eventMatchId" TEXT,
    "trigger" "PostMatchLearningTrigger" NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallOutcome" "LearningRunOutcome" NOT NULL,
    "steps" JSONB NOT NULL,

    CONSTRAINT "PostMatchLearningRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostMatchLearningRun_matchId_runAt_idx" ON "PostMatchLearningRun"("matchId", "runAt");

-- CreateIndex
CREATE INDEX "PostMatchLearningRun_eventMatchId_runAt_idx" ON "PostMatchLearningRun"("eventMatchId", "runAt");

-- CreateIndex
CREATE INDEX "PostMatchLearningRun_organisationId_overallOutcome_idx" ON "PostMatchLearningRun"("organisationId", "overallOutcome");

-- AddForeignKey
ALTER TABLE "PostMatchLearningRun" ADD CONSTRAINT "PostMatchLearningRun_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMatchLearningRun" ADD CONSTRAINT "PostMatchLearningRun_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMatchLearningRun" ADD CONSTRAINT "PostMatchLearningRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added (repo convention — Prisma's DSL cannot express "exactly one of two nullable FKs"):
-- a PostMatchLearningRun belongs to exactly one League Match or one Event Match.
ALTER TABLE "PostMatchLearningRun" ADD CONSTRAINT "PostMatchLearningRun_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));
