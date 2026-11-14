-- Optional targets for new imported plans; existing programs retain their defaults.
ALTER TABLE "CycleProgramItem"
  ADD COLUMN "plannedMinutes" INTEGER,
  ADD COLUMN "minimumQuestions" INTEGER;

ALTER TABLE "CycleProgramItem"
  ADD CONSTRAINT "CycleProgramItem_plannedMinutes_check" CHECK ("plannedMinutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "CycleProgramItem_minimumQuestions_check" CHECK ("minimumQuestions" BETWEEN 0 AND "questionGoal");
