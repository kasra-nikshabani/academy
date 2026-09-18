-- CreateEnum
CREATE TYPE "PerformanceMetric" AS ENUM ('HEIGHT_CM', 'WEIGHT_KG', 'SPRINT_20M_S', 'AGILITY_505_S', 'VERTICAL_JUMP_CM', 'COOPER_TEST_M');

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "metric" "PerformanceMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "trainingSessionId" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceRecord_playerId_metric_measuredAt_idx" ON "PerformanceRecord"("playerId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "PerformanceRecord_measuredAt_idx" ON "PerformanceRecord"("measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceRecord_playerId_metric_measuredAt_key" ON "PerformanceRecord"("playerId", "metric", "measuredAt");

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
