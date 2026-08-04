-- Additive daily-goal configuration and user-authored events.
CREATE TABLE "DailyGoalSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "activeWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "plannedRestWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "enabledMetrics" TEXT[] DEFAULT ARRAY['minutes', 'questions', 'sessions', 'reviews', 'cyclePosition']::TEXT[],
    "weekdayTargets" JSONB NOT NULL,
    "saturdayTargets" JSONB,
    "sundayTargets" JSONB,
    "firstStudyDeadline" TEXT,
    "includeMockExams" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyGoalSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualDailyGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'MAIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activeWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManualDailyGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualDailyGoalCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "manualGoalId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualDailyGoalCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyReflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "mood" TEXT,
    "whatWorked" TEXT,
    "adjustTomorrow" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyReflection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyGoalSettings_studyGuideId_key" ON "DailyGoalSettings"("studyGuideId");
CREATE UNIQUE INDEX "DailyGoalSettings_userId_studyGuideId_key" ON "DailyGoalSettings"("userId", "studyGuideId");
CREATE INDEX "DailyGoalSettings_userId_idx" ON "DailyGoalSettings"("userId");
CREATE INDEX "ManualDailyGoal_userId_studyGuideId_active_idx" ON "ManualDailyGoal"("userId", "studyGuideId", "active");
CREATE UNIQUE INDEX "ManualDailyGoalCheck_manualGoalId_dayKey_key" ON "ManualDailyGoalCheck"("manualGoalId", "dayKey");
CREATE INDEX "ManualDailyGoalCheck_userId_studyGuideId_dayKey_idx" ON "ManualDailyGoalCheck"("userId", "studyGuideId", "dayKey");
CREATE UNIQUE INDEX "DailyReflection_userId_studyGuideId_dayKey_key" ON "DailyReflection"("userId", "studyGuideId", "dayKey");
CREATE INDEX "DailyReflection_userId_studyGuideId_dayKey_idx" ON "DailyReflection"("userId", "studyGuideId", "dayKey");

ALTER TABLE "DailyGoalSettings" ADD CONSTRAINT "DailyGoalSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyGoalSettings" ADD CONSTRAINT "DailyGoalSettings_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualDailyGoal" ADD CONSTRAINT "ManualDailyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualDailyGoal" ADD CONSTRAINT "ManualDailyGoal_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualDailyGoalCheck" ADD CONSTRAINT "ManualDailyGoalCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualDailyGoalCheck" ADD CONSTRAINT "ManualDailyGoalCheck_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualDailyGoalCheck" ADD CONSTRAINT "ManualDailyGoalCheck_manualGoalId_fkey" FOREIGN KEY ("manualGoalId") REFERENCES "ManualDailyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReflection" ADD CONSTRAINT "DailyReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReflection" ADD CONSTRAINT "DailyReflection_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
