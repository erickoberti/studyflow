import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertFixedPositions, legacyCycleFingerprint, matchingMatter, nextProgramPosition, programInputSchema, type ProgramInput } from "@/lib/programmed-cycle";

type Client = Prisma.TransactionClient | typeof prisma;
export const programInclude = { items: { include: { entry: true, subject: true, discipline: true, completion: true }, orderBy: [{ roundNumber: "asc" as const }, { entry: { orderIndex: "asc" as const } }] } };
export async function getCycleProgram(userId: string, studyGuideId: string, db: Client = prisma) {
  return db.cycleProgram.findFirst({ where: { userId, studyGuideId }, include: programInclude });
}
export type LoadedProgram = NonNullable<Awaited<ReturnType<typeof getCycleProgram>>>;

export async function lockProgramGuide(tx: Prisma.TransactionClient, userId: string, studyGuideId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StudyGuide" WHERE "id" = ${studyGuideId} AND "userId" = ${userId} FOR UPDATE`;
  if (!rows.length) throw new Error("Guia indisponível.");
}

export function currentProgramItem(program: LoadedProgram, cursor: number) {
  if (program.status !== "ACTIVE") return null;
  const items = program.items.filter(item => item.roundNumber === program.currentRound);
  return items.find(item => item.entry.orderIndex === cursor) ?? items.find(item => !item.completion) ?? null;
}

export function programSuggestion(item: LoadedProgram["items"][number], program: LoadedProgram) {
  return { programItemId: item.id, entry: { id: item.entryId, orderIndex: item.entry.orderIndex, discipline: { id: item.disciplineId, name: item.discipline.name, questionGoal: item.questionGoal } }, subject: { id: item.subjectId, name: item.subject.name, weight: item.subject.weight, sortOrder: item.subject.sortOrder, tecReference: [item.tecDiscipline, item.tecTopic, item.tecUrl].filter(Boolean).join(" → ") || item.subject.tecReference }, roundNumber: item.roundNumber, totalRounds: program.totalRounds };
}

// Activation is explicit, versioned and atomic. No update/delete of historical records.
export async function saveCycleProgram(userId: string, studyGuideId: string, raw: ProgramInput) {
  const input = programInputSchema.parse(raw);
  return prisma.$transaction(async tx => {
    await lockProgramGuide(tx, userId, studyGuideId);
    if (await tx.activeStudySession.count({ where: { userId, studyGuideId, status: { in: ["ACTIVE", "PAUSED", "FINISHING"] } } })) throw new Error("Finalize ou cancele a sessão aberta antes de editar a programação.");
    const existing = await getCycleProgram(userId, studyGuideId, tx);
    if (existing && input.legacyCredits.length) throw new Error("O aproveitamento de sessões anteriores só é permitido na ativação inicial.");
    if ((existing?.version ?? 0) !== input.version) throw new Error("A programação mudou em outro dispositivo. Recarregue a matriz antes de salvar.");
    if (existing && input.rows.some(row => row.topics.length !== existing.totalRounds)) throw new Error("Use a opção de novas voltas para ampliar a programação.");
    if (!existing && input.rows.some(row => row.topics.length !== 4)) throw new Error("A programação inicial deve ter quatro voltas.");
    const entries = await tx.cycleEntry.findMany({ where: { userId, studyGuideId }, orderBy: { orderIndex: "asc" } });
    if (!existing && input.legacyFingerprint) {
      const previewState = await tx.studyGuideCycleState.findUnique({ where: { studyGuideId } });
      if (legacyCycleFingerprint(entries, previewState) !== input.legacyFingerprint) throw new Error("Seu ciclo mudou desde a comparação. Recarregue a matriz antes de ativar; nada foi substituído.");
    }
    // An empty guide can be initialized, but a populated guide is never rebuilt.
    if (!entries.length && !existing) {
      await tx.cycleEntry.createMany({ data: Array.from({ length: 16 }, (_, index) => ({ userId, studyGuideId, orderIndex: index + 1 })) });
      entries.push(...await tx.cycleEntry.findMany({ where: { userId, studyGuideId }, orderBy: { orderIndex: "asc" } }));
    }
    assertFixedPositions(entries);
    const state = await tx.studyGuideCycleState.upsert({ where: { studyGuideId }, create: { userId, studyGuideId }, update: {} });
    if (state.currentOrderIndex < 1 || state.currentOrderIndex > 16) throw new Error("O cursor atual não pertence às 16 posições. Revise a migração antes de ativar.");
    const program = existing ?? await tx.cycleProgram.create({ data: { userId, studyGuideId, initialRound: state.roundNumber, initialPosition: state.currentOrderIndex } });
    const disciplines = await tx.discipline.findMany({ where: { userId, studyGuideId } });
    const subjects = await tx.subject.findMany({ where: { userId, studyGuideId } });
    const byEntry = new Map(entries.map(entry => [entry.orderIndex, entry]));
    for (const row of input.rows) {
      let discipline = matchingMatter(row.matter, disciplines);
      if (!discipline) { discipline = await tx.discipline.create({ data: { userId, studyGuideId, name: row.matter, questionGoal: row.questionGoal } }); disciplines.push(discipline); }
      if (!discipline.active) throw new Error(`A matéria ${discipline.name} está pausada. Ative-a antes de programar.`);
      for (const [index, topic] of row.topics.entries()) {
        let subject = subjects.find(subject => subject.disciplineId === discipline!.id && subject.name === topic.name);
        if (!subject) { subject = await tx.subject.create({ data: { userId, studyGuideId, disciplineId: discipline.id, name: topic.name, sortOrder: subjects.length } }); subjects.push(subject); }
        if (!subject.active) throw new Error(`O assunto ${subject.name} está pausado.`);
        // Replacements bind another subject; renaming a used Subject is never required.
        const data = { disciplineId: discipline.id, subjectId: subject.id, questionGoal: row.questionGoal, tecDiscipline: topic.tecDiscipline || null, tecTopic: topic.tecTopic || null, tecUrl: topic.tecUrl || null, tecStatus: topic.tecStatus };
        await tx.cycleProgramItem.upsert({ where: { programId_entryId_roundNumber: { programId: program.id, entryId: byEntry.get(row.position)!.id, roundNumber: index + 1 } }, create: { programId: program.id, entryId: byEntry.get(row.position)!.id, roundNumber: index + 1, ...data }, update: data });
      }
    }
    for (const credit of input.legacyCredits) {
      const entryId = byEntry.get(credit.position)!.id;
      const source = await tx.studySession.findFirst({ where: { id: credit.sessionId, userId, studyGuideId, cycleEntryId: entryId, cyclePosition: credit.position, scope: "CYCLE", programItemId: null } });
      if (!source) throw new Error("A sessão anterior não comprova a conclusão desta posição.");
      const item = await tx.cycleProgramItem.findUniqueOrThrow({ where: { programId_entryId_roundNumber: { programId: program.id, entryId, roundNumber: 1 } } });
      await tx.cycleProgramCompletion.create({ data: { itemId: item.id, sourceSessionId: source.id, completedAt: source.date } });
    }
    if (input.legacyCredits.length === 16) {
      await tx.cycleProgram.update({ where: { id: program.id }, data: { currentRound: 2, version: { increment: 1 } } });
      await tx.studyGuideCycleState.update({ where: { studyGuideId }, data: { currentOrderIndex: 1, roundNumber: { increment: 1 }, version: { increment: 1 } } });
    }
    if (existing) await tx.cycleProgram.update({ where: { id: program.id }, data: { version: { increment: 1 } } });
    return program.id;
  }, { timeout: 60_000 });
}

export async function completeProgramItem(tx: Prisma.TransactionClient, userId: string, studyGuideId: string, itemId: string, sourceSessionId: string) {
  const item = await tx.cycleProgramItem.findFirstOrThrow({ where: { id: itemId, program: { userId, studyGuideId } }, include: { program: true, entry: true } });
  if (item.program.status !== "ACTIVE" || item.program.currentRound !== item.roundNumber) throw new Error("Esta sessão pertence a uma volta encerrada.");
  await tx.cycleProgramCompletion.upsert({ where: { itemId }, create: { itemId, sourceSessionId }, update: {} });
  const items = await tx.cycleProgramItem.findMany({ where: { programId: item.programId, roundNumber: item.roundNumber }, include: { completion: true, entry: true } });
  assertFixedPositions(items.map(value => value.entry).sort((a, b) => a.orderIndex - b.orderIndex));
  const completed = new Set(items.filter(value => value.completion).map(value => value.entryId));
  const pending = nextProgramPosition(items.map(value => value.entry).sort((a, b) => a.orderIndex - b.orderIndex), completed, item.entry.orderIndex);
  if (pending) {
    await tx.studyGuideCycleState.update({ where: { studyGuideId }, data: { currentOrderIndex: pending.orderIndex, version: { increment: 1 } } });
  } else {
    const finished = item.roundNumber === item.program.totalRounds;
    await tx.cycleProgram.update({ where: { id: item.programId }, data: { status: finished ? "COMPLETED" : "ACTIVE", currentRound: finished ? item.roundNumber : item.roundNumber + 1, version: { increment: 1 } } });
    await tx.studyGuideCycleState.update({ where: { studyGuideId }, data: { currentOrderIndex: finished ? 16 : 1, ...(!finished ? { roundNumber: { increment: 1 } } : {}), version: { increment: 1 } } });
  }
}

export async function extendCycleProgram(userId: string, studyGuideId: string, version: number) {
  return prisma.$transaction(async tx => {
    await lockProgramGuide(tx, userId, studyGuideId);
    const program = await getCycleProgram(userId, studyGuideId, tx);
    if (!program || program.version !== version || program.status !== "COMPLETED" || program.totalRounds >= 40) throw new Error("Conclua a programação atual antes de acrescentar quatro voltas.");
    const previous = program.items.filter(item => item.roundNumber > program.totalRounds - 4);
    await tx.cycleProgramItem.createMany({ data: previous.map(item => ({ programId: program.id, entryId: item.entryId, roundNumber: item.roundNumber + 4, disciplineId: item.disciplineId, subjectId: item.subjectId, questionGoal: item.questionGoal, tecDiscipline: item.tecDiscipline, tecTopic: item.tecTopic, tecUrl: item.tecUrl, tecStatus: item.tecStatus })) });
    await tx.cycleProgram.update({ where: { id: program.id }, data: { totalRounds: program.totalRounds + 4, currentRound: program.totalRounds + 1, status: "ACTIVE", version: { increment: 1 } } });
    await tx.studyGuideCycleState.update({ where: { studyGuideId }, data: { currentOrderIndex: 1, roundNumber: { increment: 1 }, version: { increment: 1 } } });
  });
}

export async function setProgramPosition(userId: string, studyGuideId: string, entryId: string) {
  return prisma.$transaction(async tx => {
    await lockProgramGuide(tx, userId, studyGuideId);
    const program = await getCycleProgram(userId, studyGuideId, tx);
    if (!program || program.status !== "ACTIVE") return "invalid" as const;
    if (await tx.activeStudySession.count({ where: { userId, studyGuideId, status: { in: ["ACTIVE", "PAUSED", "FINISHING"] } } })) return "session-active" as const;
    const item = program.items.find(item => item.entryId === entryId && item.roundNumber === program.currentRound);
    if (!item || !item.entry.active || !item.discipline.active || !item.subject.active) return "invalid" as const;
    await tx.studyGuideCycleState.update({ where: { studyGuideId }, data: { currentOrderIndex: item.entry.orderIndex, version: { increment: 1 } } });
    return "ok" as const;
  });
}
