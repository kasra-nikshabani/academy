-- CreateEnum
CREATE TYPE "EvaluationDimension" AS ENUM ('TECHNICAL', 'PHYSICAL', 'MENTAL', 'OVERALL');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "EvaluationRecommendation" AS ENUM ('ACCEPT', 'WAITLIST', 'REJECT', 'MORE_OBSERVATION');

-- CreateTable
CREATE TABLE "EvaluationTemplate" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "ageGroupId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dimension" "EvaluationDimension" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "assignedById" TEXT,
    "applicationId" TEXT,
    "trainingSessionId" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "overallScore" DOUBLE PRECISION,
    "recommendation" "EvaluationRecommendation",
    "strengths" TEXT,
    "weaknesses" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationTemplate_sportId_isActive_idx" ON "EvaluationTemplate"("sportId", "isActive");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_templateId_displayOrder_idx" ON "EvaluationCriterion"("templateId", "displayOrder");

-- CreateIndex
CREATE INDEX "Evaluation_playerId_submittedAt_idx" ON "Evaluation"("playerId", "submittedAt");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatorId_status_idx" ON "Evaluation"("evaluatorId", "status");

-- CreateIndex
CREATE INDEX "Evaluation_applicationId_idx" ON "Evaluation"("applicationId");

-- CreateIndex
CREATE INDEX "EvaluationScore_criterionId_idx" ON "EvaluationScore"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_criterionId_key" ON "EvaluationScore"("evaluationId", "criterionId");

-- AddForeignKey
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_ageGroupId_fkey" FOREIGN KEY ("ageGroupId") REFERENCES "AgeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TryoutApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
