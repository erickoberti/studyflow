-- General reviews are study records without an artificial discipline, subject or cycle position.
CREATE TYPE "StudySessionScope" AS ENUM ('CYCLE', 'SUBJECT', 'GENERAL');

ALTER TABLE "StudySession"
ADD COLUMN "scope" "StudySessionScope" NOT NULL DEFAULT 'SUBJECT';

UPDATE "StudySession"
SET "scope" = 'CYCLE'
WHERE "cyclePosition" IS NOT NULL;

ALTER TABLE "StudySession"
ALTER COLUMN "cycleEntryId" DROP NOT NULL;
