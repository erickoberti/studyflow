-- Preserve study records when a cycle position is removed.
UPDATE "StudySession" AS ss
SET "subjectId" = ce."subjectId"
FROM "CycleEntry" AS ce
WHERE ss."cycleEntryId" = ce."id"
  AND ss."subjectId" IS NULL
  AND ce."subjectId" IS NOT NULL
  AND ss."userId" = ce."userId"
  AND ss."studyGuideId" IS NOT DISTINCT FROM ce."studyGuideId";

ALTER TABLE "StudySession" DROP CONSTRAINT "StudySession_cycleEntryId_fkey";
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_cycleEntryId_fkey"
FOREIGN KEY ("cycleEntryId") REFERENCES "CycleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
