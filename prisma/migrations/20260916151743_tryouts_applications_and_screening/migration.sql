-- CreateEnum
CREATE TYPE "TryoutStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SCREENING', 'EVALUATION', 'ACCEPTED', 'REJECTED', 'WAITLIST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Tryout" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "ageGroupId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT,
    "venue" TEXT,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "heldAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "status" "TryoutStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tryout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TryoutApplication" (
    "id" TEXT NOT NULL,
    "tryoutId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "position" TEXT,
    "dominantFoot" TEXT,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "previousClub" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryoutApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screening" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "ScreeningStatus" NOT NULL DEFAULT 'PENDING',
    "ageEligible" BOOLEAN,
    "documentsComplete" BOOLEAN,
    "note" TEXT,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tryout_slug_key" ON "Tryout"("slug");

-- CreateIndex
CREATE INDEX "Tryout_status_opensAt_idx" ON "Tryout"("status", "opensAt");

-- CreateIndex
CREATE INDEX "Tryout_sportId_seasonId_idx" ON "Tryout"("sportId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "TryoutApplication_trackingCode_key" ON "TryoutApplication"("trackingCode");

-- CreateIndex
CREATE INDEX "TryoutApplication_tryoutId_status_idx" ON "TryoutApplication"("tryoutId", "status");

-- CreateIndex
CREATE INDEX "TryoutApplication_playerId_idx" ON "TryoutApplication"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TryoutApplication_tryoutId_playerId_key" ON "TryoutApplication"("tryoutId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Screening_applicationId_key" ON "Screening"("applicationId");

-- CreateIndex
CREATE INDEX "Screening_status_idx" ON "Screening"("status");

-- AddForeignKey
ALTER TABLE "Tryout" ADD CONSTRAINT "Tryout_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tryout" ADD CONSTRAINT "Tryout_ageGroupId_fkey" FOREIGN KEY ("ageGroupId") REFERENCES "AgeGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tryout" ADD CONSTRAINT "Tryout_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TryoutApplication" ADD CONSTRAINT "TryoutApplication_tryoutId_fkey" FOREIGN KEY ("tryoutId") REFERENCES "Tryout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TryoutApplication" ADD CONSTRAINT "TryoutApplication_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screening" ADD CONSTRAINT "Screening_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TryoutApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
