-- Phase 1: additive session-lifecycle storage. No existing rows are removed or rewritten.
CREATE TYPE "StudySessionMode" AS ENUM ('CYCLE', 'AVULSO');
CREATE TYPE "ActiveStudySessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHING', 'FINISHED', 'CANCELLED');

ALTER TABLE "StudyGuideCycleState" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StudySession" ADD COLUMN "activeStudySessionId" TEXT;

CREATE TABLE "ActiveStudySession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "studyGuideId" TEXT NOT NULL,
  "cycleEntryId" TEXT,
  "disciplineId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "mode" "StudySessionMode" NOT NULL,
  "status" "ActiveStudySessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
  "pausedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActiveStudySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudySession_activeStudySessionId_key" ON "StudySession"("activeStudySessionId");
CREATE INDEX "ActiveStudySession_userId_studyGuideId_status_idx" ON "ActiveStudySession"("userId", "studyGuideId", "status");
CREATE INDEX "ActiveStudySession_studyGuideId_idx" ON "ActiveStudySession"("studyGuideId");
-- A database-level partial unique index prevents two concurrent open sessions per guide.
CREATE UNIQUE INDEX "ActiveStudySession_one_open_per_guide" ON "ActiveStudySession"("userId", "studyGuideId") WHERE "status" IN ('ACTIVE', 'PAUSED', 'FINISHING');

ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_activeStudySessionId_fkey" FOREIGN KEY ("activeStudySessionId") REFERENCES "ActiveStudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActiveStudySession" ADD CONSTRAINT "ActiveStudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveStudySession" ADD CONSTRAINT "ActiveStudySession_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveStudySession" ADD CONSTRAINT "ActiveStudySession_cycleEntryId_fkey" FOREIGN KEY ("cycleEntryId") REFERENCES "CycleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActiveStudySession" ADD CONSTRAINT "ActiveStudySession_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveStudySession" ADD CONSTRAINT "ActiveStudySession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
