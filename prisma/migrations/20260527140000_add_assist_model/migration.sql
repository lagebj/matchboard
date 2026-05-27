-- CreateTable
CREATE TABLE "Assist" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assist_reportId_idx" ON "Assist"("reportId");

-- CreateIndex
CREATE INDEX "Assist_playerId_idx" ON "Assist"("playerId");

-- AddForeignKey
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;