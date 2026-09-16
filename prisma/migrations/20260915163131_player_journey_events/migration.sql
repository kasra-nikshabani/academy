-- CreateEnum
CREATE TYPE "JourneyEventType" AS ENUM ('REGISTERED', 'SCHOOL_JOINED', 'TRYOUT_REGISTERED', 'TRYOUT_ACCEPTED', 'TRYOUT_REJECTED', 'EVALUATION', 'TEAM_JOINED', 'TEAM_LEFT', 'PROMOTED', 'TRANSFERRED', 'ACHIEVEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "PlayerJourneyEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "JourneyEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "seasonId" TEXT,
    "teamId" TEXT,
    "schoolId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerJourneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerJourneyEvent_playerId_occurredAt_idx" ON "PlayerJourneyEvent"("playerId", "occurredAt");

-- CreateIndex
CREATE INDEX "PlayerJourneyEvent_type_idx" ON "PlayerJourneyEvent"("type");

-- AddForeignKey
ALTER TABLE "PlayerJourneyEvent" ADD CONSTRAINT "PlayerJourneyEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
