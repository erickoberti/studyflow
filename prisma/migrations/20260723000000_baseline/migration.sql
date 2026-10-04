-- Schema immediately before 20260724090000_phase1_active_study_session.
-- Existing installations must verify their schema and mark this baseline as applied;
-- deploying it onto existing tables is intentionally rejected before any DDL.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  ) THEN
    RAISE EXCEPTION 'Existing database: verify the pre-phase1 schema and mark baseline as applied before migrate deploy';
  END IF;
END $$;
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activeStudyGuideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGuide" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'book-open',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "questionGoal" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT,
    "disciplineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "tecReference" TEXT,
    "groupName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT,
    "subjectId" TEXT,
    "disciplineId" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT,
    "cycleEntryId" TEXT NOT NULL,
    "subjectId" TEXT,
    "cyclePosition" INTEGER,
    "cycleRound" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "questions" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetPercentage" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "dailyQuestionsGoal" INTEGER NOT NULL DEFAULT 30,
    "weeklyQuestionsGoal" INTEGER NOT NULL DEFAULT 200,
    "weightPriorityBias" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGuideSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "targetPercentage" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "dailyQuestionsGoal" INTEGER NOT NULL DEFAULT 30,
    "weeklyQuestionsGoal" INTEGER NOT NULL DEFAULT 200,
    "weightPriorityBias" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
    "organizer" TEXT,
    "role" TEXT,
    "examDate" TIMESTAMP(3),
    "sessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "questionsPerSession" INTEGER NOT NULL DEFAULT 20,
    "cycleAlgorithm" TEXT NOT NULL DEFAULT 'weighted_round_robin',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGuideSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGuideCycleState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "currentOrderIndex" INTEGER NOT NULL DEFAULT 1,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGuideCycleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "currentWeight" INTEGER NOT NULL DEFAULT 0,
    "passages" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "averagePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastStudiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metric" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "StudyGuide_userId_idx" ON "StudyGuide"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuide_userId_name_key" ON "StudyGuide"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Discipline_userId_idx" ON "Discipline"("userId");

-- CreateIndex
CREATE INDEX "Discipline_studyGuideId_idx" ON "Discipline"("studyGuideId");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_userId_studyGuideId_name_key" ON "Discipline"("userId", "studyGuideId", "name");

-- CreateIndex
CREATE INDEX "Subject_userId_idx" ON "Subject"("userId");

-- CreateIndex
CREATE INDEX "Subject_studyGuideId_idx" ON "Subject"("studyGuideId");

-- CreateIndex
CREATE INDEX "Subject_disciplineId_idx" ON "Subject"("disciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_userId_studyGuideId_disciplineId_name_key" ON "Subject"("userId", "studyGuideId", "disciplineId", "name");

-- CreateIndex
CREATE INDEX "CycleEntry_userId_idx" ON "CycleEntry"("userId");

-- CreateIndex
CREATE INDEX "CycleEntry_studyGuideId_idx" ON "CycleEntry"("studyGuideId");

-- CreateIndex
CREATE INDEX "CycleEntry_subjectId_idx" ON "CycleEntry"("subjectId");

-- CreateIndex
CREATE INDEX "CycleEntry_disciplineId_idx" ON "CycleEntry"("disciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleEntry_userId_studyGuideId_orderIndex_key" ON "CycleEntry"("userId", "studyGuideId", "orderIndex");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "StudySession"("userId");

-- CreateIndex
CREATE INDEX "StudySession_studyGuideId_idx" ON "StudySession"("studyGuideId");

-- CreateIndex
CREATE INDEX "StudySession_date_idx" ON "StudySession"("date");

-- CreateIndex
CREATE INDEX "StudySession_cycleEntryId_idx" ON "StudySession"("cycleEntryId");

-- CreateIndex
CREATE INDEX "StudySession_subjectId_idx" ON "StudySession"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuideSettings_studyGuideId_key" ON "StudyGuideSettings"("studyGuideId");

-- CreateIndex
CREATE INDEX "StudyGuideSettings_userId_idx" ON "StudyGuideSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuideSettings_userId_studyGuideId_key" ON "StudyGuideSettings"("userId", "studyGuideId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGuideCycleState_studyGuideId_key" ON "StudyGuideCycleState"("studyGuideId");

-- CreateIndex
CREATE INDEX "StudyGuideCycleState_userId_idx" ON "StudyGuideCycleState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectProgress_subjectId_key" ON "SubjectProgress"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectProgress_userId_studyGuideId_idx" ON "SubjectProgress"("userId", "studyGuideId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalDefinition_code_key" ON "GoalDefinition"("code");

-- CreateIndex
CREATE INDEX "GoalDefinition_metric_active_idx" ON "GoalDefinition"("metric", "active");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeStudyGuideId_fkey" FOREIGN KEY ("activeStudyGuideId") REFERENCES "StudyGuide"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGuide" ADD CONSTRAINT "StudyGuide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleEntry" ADD CONSTRAINT "CycleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleEntry" ADD CONSTRAINT "CycleEntry_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleEntry" ADD CONSTRAINT "CycleEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleEntry" ADD CONSTRAINT "CycleEntry_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_cycleEntryId_fkey" FOREIGN KEY ("cycleEntryId") REFERENCES "CycleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGuideSettings" ADD CONSTRAINT "StudyGuideSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGuideSettings" ADD CONSTRAINT "StudyGuideSettings_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGuideCycleState" ADD CONSTRAINT "StudyGuideCycleState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGuideCycleState" ADD CONSTRAINT "StudyGuideCycleState_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectProgress" ADD CONSTRAINT "SubjectProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectProgress" ADD CONSTRAINT "SubjectProgress_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectProgress" ADD CONSTRAINT "SubjectProgress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
