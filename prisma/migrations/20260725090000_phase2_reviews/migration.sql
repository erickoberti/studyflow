-- Phase 2: additive review schedule. No existing data is modified or removed.
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'DISMISSED');
CREATE TABLE "ReviewSchedule" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "studyGuideId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL, "sourceSessionId" TEXT, "dueAt" TIMESTAMP(3) NOT NULL,
  "intervalDays" INTEGER NOT NULL, "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3), "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewSchedule_userId_studyGuideId_status_dueAt_idx" ON "ReviewSchedule"("userId", "studyGuideId", "status", "dueAt");
CREATE INDEX "ReviewSchedule_subjectId_idx" ON "ReviewSchedule"("subjectId");
CREATE INDEX "ReviewSchedule_sourceSessionId_idx" ON "ReviewSchedule"("sourceSessionId");
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
