CREATE TYPE "MockExamStatus" AS ENUM ('COMPLETED');
CREATE TYPE "SyllabusStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" "MockExamStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamDisciplineResult" (
    "id" TEXT NOT NULL,
    "mockExamId" TEXT NOT NULL,
    "disciplineId" TEXT,
    "disciplineName" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "questions" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockExamDisciplineResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyllabusProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" "SyllabusStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyllabusProgress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MockExam_userId_studyGuideId_takenAt_idx" ON "MockExam"("userId", "studyGuideId", "takenAt");
CREATE UNIQUE INDEX "MockExamDisciplineResult_mockExamId_disciplineId_key" ON "MockExamDisciplineResult"("mockExamId", "disciplineId");
CREATE INDEX "MockExamDisciplineResult_disciplineId_idx" ON "MockExamDisciplineResult"("disciplineId");
CREATE UNIQUE INDEX "SyllabusProgress_subjectId_key" ON "SyllabusProgress"("subjectId");
CREATE INDEX "SyllabusProgress_userId_studyGuideId_status_idx" ON "SyllabusProgress"("userId", "studyGuideId", "status");

ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamDisciplineResult" ADD CONSTRAINT "MockExamDisciplineResult_mockExamId_fkey" FOREIGN KEY ("mockExamId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamDisciplineResult" ADD CONSTRAINT "MockExamDisciplineResult_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyllabusProgress" ADD CONSTRAINT "SyllabusProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyllabusProgress" ADD CONSTRAINT "SyllabusProgress_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyllabusProgress" ADD CONSTRAINT "SyllabusProgress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
