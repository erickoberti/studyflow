-- A session tied to a subject may exist without a cycle position.
ALTER TABLE "StudySession" ALTER COLUMN "cycleEntryId" DROP NOT NULL;
