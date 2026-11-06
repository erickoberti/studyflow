BEGIN;

-- Additive only: no UPDATE, DELETE, backfill or cycle conversion.
-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "disciplineNameSnapshot" TEXT,
ADD COLUMN     "programItemId" TEXT,
ADD COLUMN     "subjectNameSnapshot" TEXT,
ADD COLUMN     "tecReferenceSnapshot" TEXT;

-- AlterTable
ALTER TABLE "ActiveStudySession" ADD COLUMN     "programItemId" TEXT;

-- CreateTable
CREATE TABLE "CycleProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "totalRounds" INTEGER NOT NULL DEFAULT 4,
    "initialRound" INTEGER NOT NULL,
    "initialPosition" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleProgramItem" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "questionGoal" INTEGER NOT NULL,
    "tecDiscipline" TEXT,
    "tecTopic" TEXT,
    "tecUrl" TEXT,
    "tecStatus" TEXT NOT NULL DEFAULT 'SUGGESTED',

    CONSTRAINT "CycleProgramItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleProgramCompletion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceSessionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleProgramCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CycleProgram_studyGuideId_key" ON "CycleProgram"("studyGuideId");

-- CreateIndex
CREATE INDEX "CycleProgram_userId_idx" ON "CycleProgram"("userId");

-- CreateIndex
CREATE INDEX "CycleProgramItem_subjectId_idx" ON "CycleProgramItem"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleProgramItem_programId_entryId_roundNumber_key" ON "CycleProgramItem"("programId", "entryId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CycleProgramCompletion_itemId_key" ON "CycleProgramCompletion"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleProgramCompletion_sourceSessionId_key" ON "CycleProgramCompletion"("sourceSessionId");

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_programItemId_fkey" FOREIGN KEY ("programItemId") REFERENCES "CycleProgramItem"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveStudySession" ADD CONSTRAINT "ActiveStudySession_programItemId_fkey" FOREIGN KEY ("programItemId") REFERENCES "CycleProgramItem"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgram" ADD CONSTRAINT "CycleProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgram" ADD CONSTRAINT "CycleProgram_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgramItem" ADD CONSTRAINT "CycleProgramItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "CycleProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgramItem" ADD CONSTRAINT "CycleProgramItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CycleEntry"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgramItem" ADD CONSTRAINT "CycleProgramItem_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgramItem" ADD CONSTRAINT "CycleProgramItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgramCompletion" ADD CONSTRAINT "CycleProgramCompletion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CycleProgramItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleProgramCompletion" ADD CONSTRAINT "CycleProgramCompletion_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "StudySession"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "CycleProgram" ADD CONSTRAINT "CycleProgram_valid_state" CHECK ("currentRound" >= 1 AND "currentRound" <= "totalRounds" AND "totalRounds" BETWEEN 4 AND 40 AND "totalRounds" % 4 = 0 AND "status" IN ('ACTIVE', 'COMPLETED'));
ALTER TABLE "CycleProgramItem" ADD CONSTRAINT "CycleProgramItem_valid_config" CHECK ("roundNumber" BETWEEN 1 AND 40 AND "questionGoal" BETWEEN 1 AND 500 AND "tecStatus" IN ('SUGGESTED', 'CONFIRMED'));

-- Serialize legacy structural actions with program activation as well as new actions.
CREATE FUNCTION "protect_programmed_cycle_positions"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE guide_id text;
BEGIN
  guide_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."studyGuideId" ELSE NEW."studyGuideId" END;
  PERFORM "id" FROM "StudyGuide" WHERE "id" = guide_id FOR UPDATE;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM "CycleProgram" WHERE "studyGuideId" = guide_id) THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW."orderIndex" = OLD."orderIndex" AND NEW."active" = OLD."active" AND NEW."studyGuideId" IS NOT DISTINCT FROM OLD."studyGuideId" THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION 'As 16 posições programadas são fixas. Edite a matriz do ciclo.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER "CycleEntry_program_structure_guard" BEFORE INSERT OR UPDATE OR DELETE ON "CycleEntry" FOR EACH ROW EXECUTE FUNCTION "protect_programmed_cycle_positions"();

-- Defer only these checks to commit so explicit whole-guide deletion remains compatible.
ALTER TABLE "StudySession" ALTER CONSTRAINT "StudySession_programItemId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ActiveStudySession" ALTER CONSTRAINT "ActiveStudySession_programItemId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CycleProgramItem" ALTER CONSTRAINT "CycleProgramItem_entryId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CycleProgramItem" ALTER CONSTRAINT "CycleProgramItem_disciplineId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CycleProgramItem" ALTER CONSTRAINT "CycleProgramItem_subjectId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CycleProgramCompletion" ALTER CONSTRAINT "CycleProgramCompletion_sourceSessionId_fkey" DEFERRABLE INITIALLY DEFERRED;

-- Serialize even an in-flight legacy client with opt-in activation.
CREATE FUNCTION "protect_programmed_cycle_session"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE program_id text;
BEGIN
  IF NEW."mode" <> 'CYCLE' OR NEW."status" NOT IN ('ACTIVE', 'PAUSED', 'FINISHING') THEN RETURN NEW; END IF;
  PERFORM "id" FROM "StudyGuide" WHERE "id" = NEW."studyGuideId" FOR UPDATE;
  SELECT "id" INTO program_id FROM "CycleProgram" WHERE "studyGuideId" = NEW."studyGuideId";
  IF program_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "CycleProgramItem" item JOIN "CycleProgram" program ON program."id" = item."programId"
    WHERE item."id" = NEW."programItemId" AND item."programId" = program_id
      AND item."entryId" = NEW."cycleEntryId" AND item."subjectId" = NEW."subjectId"
      AND item."disciplineId" = NEW."disciplineId" AND item."roundNumber" = program."currentRound"
      AND program."status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'A programação mudou. Preserve a sessão anterior para conferência.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ActiveStudySession_program_guard" BEFORE INSERT ON "ActiveStudySession" FOR EACH ROW EXECUTE FUNCTION "protect_programmed_cycle_session"();

COMMIT;
