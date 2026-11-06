import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/lib/prisma";
import { cycleService } from "../src/lib/cycle-service";
import { defaultProgramRows, type ProgramRow } from "../src/lib/programmed-cycle";
import { extendCycleProgram, getCycleProgram, saveCycleProgram, setProgramPosition } from "../src/lib/programmed-cycle-service";

const dbUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = process.env.PROGRAM_CYCLE_INTEGRATION === "true" && dbUrl?.hostname === "127.0.0.1" && dbUrl?.pathname === "/studyflow_program_test";

test("migração preserva dados, 4×16 concluem uma vez, edições não reescrevem história e novas voltas reutilizam posições", { skip: !isolated, timeout: 120_000 }, async () => {
  const user = await prisma.user.create({ data: { name: "Ciclo fictício", email: `program-${Date.now()}@example.test`, passwordHash: "not-a-login" } });
  const guide = await prisma.studyGuide.create({ data: { userId: user.id, name: "Programa isolado" } });
  const userId = user.id, studyGuideId = guide.id; const scope = { userId, studyGuideId };
  try {
    const matter = await prisma.discipline.create({ data: { ...scope, name: "Português" } });
    const old = await prisma.subject.create({ data: { ...scope, disciplineId: matter.id, name: "Assunto antigo", tecReference: "Referência antiga" } });
    await prisma.subjectProgress.create({ data: { ...scope, subjectId: old.id, passages: 1, totalQuestions: 10, correct: 8, wrong: 2, averagePercentage: 80 } });
    await prisma.cycleEntry.createMany({ data: Array.from({ length: 16 }, (_, index) => ({ ...scope, disciplineId: matter.id, subjectId: old.id, orderIndex: index + 1 })) });
    const originalEntries = await prisma.cycleEntry.findMany({ where: scope, orderBy: { orderIndex: "asc" } });
    const legacy = await prisma.studySession.create({ data: { ...scope, cycleEntryId: originalEntries[0].id, subjectId: old.id, scope: "CYCLE", cyclePosition: 1, cycleRound: null, questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 20, date: new Date("2026-10-01") } });
    const oldProgress = await prisma.subjectProgress.findUniqueOrThrow({ where: { subjectId: old.id } });
    await prisma.studyGuideCycleState.create({ data: { ...scope, currentOrderIndex: 5, roundNumber: 3 } });
    await assert.rejects(saveCycleProgram(userId, studyGuideId, { version: 0, rows: defaultProgramRows(), legacyCredits: [], legacyFingerprint: "stale-preview" }), /mudou desde a comparação/);
    assert.equal(await prisma.cycleProgram.count({ where: scope }), 0);
    await saveCycleProgram(userId, studyGuideId, { version: 0, rows: defaultProgramRows(), legacyCredits: [{ position: 1, sessionId: legacy.id }] });
    assert.deepEqual(await prisma.cycleEntry.findMany({ where: scope, orderBy: { orderIndex: "asc" } }), originalEntries);
    assert.deepEqual(await prisma.studySession.findUnique({ where: { id: legacy.id } }), legacy);
    assert.deepEqual(await prisma.subjectProgress.findUnique({ where: { subjectId: old.id } }), oldProgress);
    assert.equal((await prisma.subject.findUniqueOrThrow({ where: { id: old.id } })).name, "Assunto antigo");
    assert.equal((await prisma.studyGuideCycleState.findUniqueOrThrow({ where: { studyGuideId } })).currentOrderIndex, 5);
    assert.equal((await cycleService.getCurrent(userId, studyGuideId))?.roundNumber, 1);
    assert.equal((await cycleService.getCurrent(userId, studyGuideId))?.entry.orderIndex, 5);
    assert.equal(await prisma.discipline.count({ where: { ...scope, name: "Língua Portuguesa" } }), 0);
    await assert.rejects(prisma.cycleEntry.create({ data: { ...scope, disciplineId: matter.id, subjectId: old.id, orderIndex: 17 } }), /16 posições programadas/);
    await assert.rejects(prisma.cycleEntry.update({ where: { id: originalEntries[0].id }, data: { orderIndex: 17 } }), /16 posições programadas/);
    await assert.rejects(prisma.activeStudySession.create({ data: { ...scope, cycleEntryId: originalEntries[0].id, subjectId: old.id, disciplineId: matter.id, mode: "CYCLE" } }), /programação mudou/);

    await setProgramPosition(userId, studyGuideId, originalEntries[15].id);
    const active = (await cycleService.start(userId, studyGuideId, { mode: "CYCLE", timerRunning: false }))!;
    await assert.rejects(saveCycleProgram(userId, studyGuideId, { version: 1, rows: defaultProgramRows(), legacyCredits: [] }), /sessão aberta/);
    const results = await Promise.all([cycleService.finish(userId, studyGuideId, active.id, active.version, { questions: 20, correct: 10, minutes: 15 }), cycleService.finish(userId, studyGuideId, active.id, active.version, { questions: 20, correct: 10, minutes: 15 })]);
    assert.equal(results.filter(result => result.idempotent).length, 1);
    assert.equal(await prisma.studySession.count({ where: { activeStudySessionId: active.id } }), 1);
    assert.equal((await getCycleProgram(userId, studyGuideId))!.currentRound, 1);
    assert.equal((await getCycleProgram(userId, studyGuideId))!.items.filter(item => item.completion).length, 2);
    const saved = await prisma.studySession.findUniqueOrThrow({ where: { id: results[0].sessionId } });
    assert.equal(saved.cycleRound, 1);
    assert.equal(saved.subjectNameSnapshot, "Sistemas Operacionais");
    assert.deepEqual((await prisma.reviewSchedule.findMany({ where: { sourceSessionId: saved.id }, orderBy: { intervalDays: "asc" } })).map(review => review.intervalDays), [1,7,30]);

    const program = (await getCycleProgram(userId, studyGuideId))!;
    const rows: ProgramRow[] = originalEntries.map(entry => { const items = program.items.filter(item => item.entryId === entry.id); return { position: entry.orderIndex, matter: items[0].discipline.name, questionGoal: items[0].questionGoal, topics: items.map(item => ({ name: item.subject.name, tecDiscipline: item.tecDiscipline ?? "", tecTopic: item.tecTopic ?? "", tecUrl: item.tecUrl ?? "", tecStatus: item.tecStatus as "SUGGESTED" | "CONFIRMED" })) }; });
    rows[15].topics[0] = { name: "Sistemas Operacionais — corrigido", tecDiscipline: "Nome conferido pelo usuário", tecTopic: "Subtópico conferido", tecUrl: "https://www.tecconcursos.com.br/questoes", tecStatus: "CONFIRMED" };
    await saveCycleProgram(userId, studyGuideId, { version: program.version, rows, legacyCredits: [] });
    assert.deepEqual(await prisma.studySession.findUnique({ where: { id: saved.id } }), saved);
    assert.equal((await getCycleProgram(userId, studyGuideId))!.items.find(item => item.roundNumber === 1 && item.entry.orderIndex === 16)!.subject.name, rows[15].topics[0].name);
    await assert.rejects(saveCycleProgram(userId, studyGuideId, { version: program.version, rows, legacyCredits: [] }), /outro dispositivo/);
    await assert.rejects(cycleService.start(userId, studyGuideId, { mode: "CYCLE", expectedProgramItemId: "stale-offline" }), /programação mudou/);
    assert.equal(await prisma.activeStudySession.count({ where: { ...scope, status: { in: ["ACTIVE", "PAUSED"] } } }), 0);

    const study = async (advanceCycle = true) => {
      const session = (await cycleService.start(userId, studyGuideId, { mode: "CYCLE", timerRunning: false }))!;
      return cycleService.finish(userId, studyGuideId, session.id, session.version, { questions: 20, correct: 16, minutes: 20, advanceCycle });
    };
    const before = (await getCycleProgram(userId, studyGuideId))!.items.filter(item => item.completion).length;
    await study(false);
    assert.equal((await getCycleProgram(userId, studyGuideId))!.items.filter(item => item.completion).length, before);
    let iterations = 0;
    while ((await getCycleProgram(userId, studyGuideId))!.status === "ACTIVE") {
      await study(); iterations++;
      assert.ok(iterations <= 64, "A programação precisa encerrar sem criar uma quinta volta automaticamente.");
    }
    const finished = (await getCycleProgram(userId, studyGuideId))!;
    assert.equal(finished.currentRound, 4); assert.equal(finished.items.filter(item => item.completion).length, 64);
    assert.equal(await prisma.cycleEntry.count({ where: scope }), 16);
    assert.equal(await cycleService.getCurrent(userId, studyGuideId), null);
    assert.deepEqual(await prisma.studySession.findUnique({ where: { id: legacy.id } }), legacy);
    const sessionsBeforeExtend = await prisma.studySession.count({ where: scope });
    await extendCycleProgram(userId, studyGuideId, finished.version);
    const extended = (await getCycleProgram(userId, studyGuideId))!;
    assert.equal(extended.currentRound, 5); assert.equal(extended.totalRounds, 8); assert.equal(extended.items.length, 128);
    const archivedActive = await prisma.activeStudySession.findFirstOrThrow({ where: { ...scope, status: "FINISHED", programItem: { roundNumber: 1 } } });
    const restoredArchive = await prisma.activeStudySession.create({ data: { ...archivedActive, id: `restore-check-${archivedActive.id}` } });
    await prisma.activeStudySession.delete({ where: { id: restoredArchive.id } });
    assert.equal(await prisma.studySession.count({ where: scope }), sessionsBeforeExtend);
    assert.equal(await prisma.cycleEntry.count({ where: scope }), 16);
    assert.equal((await cycleService.getCurrent(userId, studyGuideId))?.entry.orderIndex, 1);
    await prisma.studyGuide.delete({ where: { id: studyGuideId } });
    assert.equal(await prisma.studySession.count({ where: scope }), 0);
  } finally {
    // Order respects the historical foreign keys. Only this synthetic account is removed.
    await prisma.cycleProgramCompletion.deleteMany({ where: { item: { program: scope } } });
    await prisma.studySession.deleteMany({ where: scope }); await prisma.activeStudySession.deleteMany({ where: scope });
    await prisma.cycleProgram.deleteMany({ where: scope }); await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
