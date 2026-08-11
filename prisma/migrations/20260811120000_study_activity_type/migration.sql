CREATE TYPE "StudyActivityType" AS ENUM ('QUESTIONS', 'CLASS', 'READING', 'REVIEW');

ALTER TABLE "StudySession"
ADD COLUMN "activityType" "StudyActivityType" NOT NULL DEFAULT 'QUESTIONS';

UPDATE "StudySession"
SET "activityType" = 'CLASS'
WHERE "questions" = 0 AND "notes" LIKE '%[Aula]%';
