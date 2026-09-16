-- DropIndex
DROP INDEX "TrainingSession_teamId_startsAt_key";

-- CreateIndex
CREATE INDEX "TrainingSession_teamId_startsAt_idx" ON "TrainingSession"("teamId", "startsAt");
