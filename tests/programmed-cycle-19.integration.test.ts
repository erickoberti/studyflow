import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/lib/prisma";
import { cycleService } from "../src/lib/cycle-service";
import { defaultProgramRows, type ProgramRow } from "../src/lib/programmed-cycle";
import { getCycleProgram, saveCycleProgram, extendCycleProgram, setProgramPosition } from "../src/lib/programmed-cycle-service";
import { BACKUP_FORMAT, BACKUP_VERSION, BACKUP_MODELS, backupSelect, validateBackup } from "../src/lib/backup";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = process.env.PROGRAM_CYCLE_INTEGRATION === "true" && url?.hostname === "127.0.0.1" && url.pathname === "/studyflow_program_test";

test("19×4 segue posição e volta, preserva outro guia e restaura backup com metas", { skip: !isolated, timeout: 180_000 }, async () => {
  const user = await prisma.user.create({ data: { name: "Plano fictício", email: `nineteen-${Date.now()}@example.test`, passwordHash: "not-a-login" } });
  const userId = user.id;
  const guide = await prisma.studyGuide.create({ data: { userId, name: "Novo plano 19" } });
  const studyGuideId = guide.id;
  const scope = { userId, studyGuideId };
  try {
    const previousGuide = await prisma.studyGuide.create({ data: { userId, name: "Anterior" } });
    await saveCycleProgram(userId, previousGuide.id, { version: 0, rows: defaultProgramRows(), legacyCredits: [] });
    const previous = await getCycleProgram(userId, previousGuide.id);
    const previousState = await prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: previousGuide.id } });
    const rows: ProgramRow[] = Array.from({ length: 19 }, (_, index) => ({
      position: index + 1, matter: `Matéria ${index % 3}`, questionGoal: index % 3 + 4,
      topics: Array.from({ length: 4 }, (_, round) => ({ name: `Posição ${index + 1} volta ${round + 1}`, tecDiscipline: "", tecTopic: "", tecUrl: "", tecStatus: "SUGGESTED", plannedMinutes: index + 10, minimumQuestions: 1 })),
    }));
    await saveCycleProgram(userId, studyGuideId, { version: 0, rows, legacyCredits: [] });
    assert.equal((await getCycleProgram(userId, studyGuideId))!.items.length, 76);
    await assert.rejects(saveCycleProgram(userId, studyGuideId, { version: 1, rows: rows.slice(0, 18), legacyCredits: [] }), /quantidade de posições/);

    // Finishing position 19 early cannot skip the remaining positions of round 1.
    const entry19 = (await getCycleProgram(userId, studyGuideId))!.items.find(item => item.entry.orderIndex === 19)!.entryId;
    await setProgramPosition(userId, studyGuideId, entry19);
    const early = (await cycleService.start(userId, studyGuideId, { mode: "CYCLE", timerRunning: false }))!;
    await cycleService.finish(userId, studyGuideId, early.id, early.version, { questions: 1, correct: 1, minutes: 1 });
    assert.equal((await getCycleProgram(userId, studyGuideId))!.currentRound, 1);
    assert.equal((await cycleService.getCurrent(userId, studyGuideId))!.entry.orderIndex, 1);
    for (let round = 1; round <= 4; round++) {
      for (let position = 1; position <= (round === 1 ? 18 : 19); position++) {
        const current = (await cycleService.getCurrent(userId, studyGuideId))!;
        assert.equal(current.entry.orderIndex, position);
        assert.equal(current.roundNumber, round);
        assert.equal(current.subject.name, `Posição ${position} volta ${round}`);
        assert.equal("plannedMinutes" in current ? current.plannedMinutes : null, position + 9);
        const active = (await cycleService.start(userId, studyGuideId, { mode: "CYCLE", timerRunning: false }))!;
        await cycleService.finish(userId, studyGuideId, active.id, active.version, { questions: 1, correct: 1, minutes: 1 });
      }
    }
    const finished = (await getCycleProgram(userId, studyGuideId))!;
    assert.equal(finished.status, "COMPLETED");
    assert.equal(finished.currentRound, 4);
    assert.equal(finished.items.filter(item => item.completion).length, 76);
    assert.equal(await cycleService.getCurrent(userId, studyGuideId), null);
    assert.equal((await prisma.studyGuideCycleState.findUniqueOrThrow({ where: { studyGuideId } })).currentOrderIndex, 19);
    assert.deepEqual(await getCycleProgram(userId, previousGuide.id), previous);
    assert.deepEqual(await prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: previousGuide.id } }), previousState);

    const data: Record<string, unknown> = {};
    for (const model of BACKUP_MODELS) {
      const delegate = prisma[model[0].toLowerCase() + model.slice(1) as keyof typeof prisma] as unknown as { findMany(args: unknown): Promise<unknown[]> };
      const where = model === "CycleProgramItem" ? { program: { userId } } : model === "CycleProgramCompletion" ? { item: { program: { userId } } } : model === "MockExamDisciplineResult" ? { mockExam: { userId } } : { userId };
      data[model] = await delegate.findMany({ where, select: backupSelect(model) });
    }
    const backup = JSON.parse(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, accountId: userId, exportedAt: new Date().toISOString(), activeStudyGuideId: null, data }));
    assert.equal(validateBackup(backup, userId).data.CycleProgramItem.length, 140);
    for (const item of backup.data.CycleProgramItem) { delete item.plannedMinutes; delete item.minimumQuestions; }
    assert.ok(validateBackup(backup, userId).data.CycleProgramItem.every(item => item.plannedMinutes === null && item.minimumQuestions === null));
    await extendCycleProgram(userId, studyGuideId, finished.version);
    const extended = (await getCycleProgram(userId, studyGuideId))!;
    assert.equal(extended.items.length, 152);
    assert.equal(extended.currentRound, 5);
    assert.equal(extended.items.find(item => item.roundNumber === 5 && item.entry.orderIndex === 19)!.plannedMinutes, 28);
  } finally {
    await prisma.cycleProgramCompletion.deleteMany({ where: { item: { program: { userId } } } });
    await prisma.studySession.deleteMany({ where: { userId } });
    await prisma.activeStudySession.deleteMany({ where: { userId } });
    await prisma.cycleProgram.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
