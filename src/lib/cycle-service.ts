import { ActiveStudySessionStatus, Prisma, StudySessionMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { advanceWeightedState, selectWeightedSubject, type CycleEngineSubject } from "@/lib/cycle-engine";

export type CycleSessionDTO = {
  id: string; mode: "CYCLE" | "AVULSO"; status: "ACTIVE" | "PAUSED" | "FINISHING" | "FINISHED" | "CANCELLED";
  version: number; startedAt: string; accumulatedSeconds: number; pausedAt: string | null;
  cycle: { entryId: string; position: number; round: number } | null;
  discipline: { id: string; name: string; questionGoal: number };
  subject: { id: string; name: string; weight: number; averagePercentage: number; lastStudiedAt: string | null };
};

type Client = Prisma.TransactionClient | typeof prisma;
const openStates = [ActiveStudySessionStatus.ACTIVE, ActiveStudySessionStatus.PAUSED, ActiveStudySessionStatus.FINISHING];

export class CycleConflictError extends Error {
  constructor(message: string, public readonly code: string) { super(message); this.name = "CycleConflictError"; }
}

function toEngine(subject: { id: string; name: string; disciplineId: string; weight: number; sortOrder: number; progress: { currentWeight: number; passages: number; averagePercentage: number; lastStudiedAt: Date | null } | null }): CycleEngineSubject {
  return { id: subject.id, name: subject.name, disciplineId: subject.disciplineId, weight: subject.weight, sortOrder: subject.sortOrder, currentWeight: subject.progress?.currentWeight ?? 0, passages: subject.progress?.passages ?? 0, averagePercentage: subject.progress?.averagePercentage ?? 0, lastStudiedAt: subject.progress?.lastStudiedAt ?? null };
}

function elapsedSeconds(session: { accumulatedSeconds: number; status: ActiveStudySessionStatus; pausedAt: Date | null }) {
  if (session.status !== ActiveStudySessionStatus.ACTIVE) return session.accumulatedSeconds;
  return session.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - (session.pausedAt?.getTime() ?? Date.now())) / 1000));
}

export class CycleService {
  async getCurrent(userId: string, studyGuideId: string) {
    const [state, entries] = await Promise.all([
      prisma.studyGuideCycleState.upsert({ where: { studyGuideId }, create: { userId, studyGuideId }, update: {} }),
      prisma.cycleEntry.findMany({ where: { userId, studyGuideId, active: true }, include: { discipline: true, subject: { include: { discipline: true } } }, orderBy: { orderIndex: "asc" } }),
    ]);
    const eligibleEntries = entries.filter((item) => (item.discipline ?? item.subject?.discipline)?.active);
    const entry = eligibleEntries.find((item) => item.orderIndex >= state.currentOrderIndex) ?? eligibleEntries[0];
    const discipline = entry?.discipline ?? entry?.subject?.discipline;
    if (!entry || !discipline) return null;
    const subjects = await prisma.subject.findMany({ where: { userId, studyGuideId, disciplineId: discipline.id, active: true }, include: { progress: true }, orderBy: { sortOrder: "asc" } });
    const selected = selectWeightedSubject(subjects.map(toEngine));
    if (!selected) return null;
    return { entry: { id: entry.id, orderIndex: entry.orderIndex, discipline: { id: discipline.id, name: discipline.name, questionGoal: discipline.questionGoal } }, subject: { id: selected.id, name: selected.name, weight: selected.weight, sortOrder: selected.sortOrder, tecReference: null }, roundNumber: state.roundNumber };
  }

  async preview(userId: string, studyGuideId: string, count = 5) {
    const current = await this.getCurrent(userId, studyGuideId);
    if (!current) return [];
    const rawEntries = await prisma.cycleEntry.findMany({ where: { userId, studyGuideId, active: true }, include: { discipline: true, subject: { include: { discipline: true } } }, orderBy: { orderIndex: "asc" } });
    const entries = rawEntries
      .map((entry) => ({ ...entry, effectiveDiscipline: entry.discipline ?? entry.subject?.discipline ?? null }))
      .filter((entry) => entry.effectiveDiscipline?.active);
    const subjects = await prisma.subject.findMany({ where: { userId, studyGuideId, active: true }, include: { progress: true }, orderBy: { sortOrder: "asc" } });
    let virtual = subjects.map(toEngine); const lastByDiscipline = new Map<string, string>();
    const start = Math.max(0, entries.findIndex((entry) => entry.id === current.entry.id));
    return Array.from({ length: Math.min(count, entries.length) }, (_, offset) => {
      const entry = entries[(start + offset) % entries.length]; const discipline = entry.effectiveDiscipline; const candidates = virtual.filter((subject) => subject.disciplineId === discipline?.id);
      const chosen = selectWeightedSubject(candidates, discipline ? lastByDiscipline.get(discipline.id) : undefined);
      if (!chosen || !discipline) return null;
      const updated = new Map(advanceWeightedState(candidates, chosen.id).map((subject) => [subject.id, subject]));
      virtual = virtual.map((subject) => updated.get(subject.id) ?? subject); lastByDiscipline.set(discipline.id, chosen.id);
      return { entryId: entry.id, orderIndex: entry.orderIndex, roundNumber: current.roundNumber + Math.floor((start + offset) / entries.length), discipline: { id: discipline.id, name: discipline.name, questionGoal: discipline.questionGoal }, subject: { id: chosen.id, name: chosen.name, weight: chosen.weight } };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  private async dto(client: Client, sessionId: string): Promise<CycleSessionDTO | null> {
    const value = await client.activeStudySession.findUnique({ where: { id: sessionId }, include: { discipline: true, subject: { include: { progress: true } }, cycleEntry: true, studyGuide: { include: { cycleState: true } } } });
    if (!value) return null;
    return { id: value.id, mode: value.mode, status: value.status, version: value.version, startedAt: value.startedAt.toISOString(), accumulatedSeconds: elapsedSeconds(value), pausedAt: value.pausedAt?.toISOString() ?? null, cycle: value.cycleEntry ? { entryId: value.cycleEntry.id, position: value.cycleEntry.orderIndex, round: value.studyGuide.cycleState?.roundNumber ?? 1 } : null, discipline: { id: value.discipline.id, name: value.discipline.name, questionGoal: value.discipline.questionGoal }, subject: { id: value.subject.id, name: value.subject.name, weight: value.subject.weight, averagePercentage: value.subject.progress?.averagePercentage ?? 0, lastStudiedAt: value.subject.progress?.lastStudiedAt?.toISOString() ?? null } };
  }

  async getActive(userId: string, studyGuideId: string) {
    const active = await prisma.activeStudySession.findFirst({ where: { userId, studyGuideId, status: { in: openStates } }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    return active ? this.dto(prisma, active.id) : null;
  }

  async start(userId: string, studyGuideId: string, input: { mode: "CYCLE" | "AVULSO"; disciplineId?: string; subjectId?: string; operationId?: string }) {
    return prisma.$transaction(async (tx) => {
      if (input.operationId) {
        const processed = await tx.activeStudySession.findFirst({ where: { id: input.operationId, userId, studyGuideId }, select: { id: true } });
        if (processed) return this.dto(tx, processed.id);
      }
      const existing = await tx.activeStudySession.findFirst({ where: { userId, studyGuideId, status: { in: openStates } }, select: { id: true } });
      if (existing) return this.dto(tx, existing.id);
      let cycleEntryId: string | undefined; let disciplineId = input.disciplineId; let subjectId = input.subjectId;
      if (input.mode === "CYCLE") { const current = await this.currentInTransaction(tx, userId, studyGuideId); if (!current?.subject || !current.entry.discipline) throw new Error("Não há item elegível no ciclo."); cycleEntryId = current.entry.id; disciplineId = current.entry.discipline.id; subjectId = current.subject.id; }
      if (!disciplineId || !subjectId) throw new Error("Disciplina e assunto são obrigatórios no estudo avulso.");
      const subject = await tx.subject.findFirst({ where: { id: subjectId, userId, studyGuideId, disciplineId, active: true } });
      if (!subject) throw new Error("O assunto não pertence à disciplina ou está inativo.");
      if (!cycleEntryId) cycleEntryId = (await tx.cycleEntry.findFirst({ where: { userId, studyGuideId, active: true }, orderBy: { orderIndex: "asc" }, select: { id: true } }))?.id;
      if (!cycleEntryId) throw new Error("Crie ao menos uma posição de ciclo antes de registrar estudo.");
      const active = await tx.activeStudySession.create({ data: { ...(input.operationId ? { id: input.operationId } : {}), userId, studyGuideId, cycleEntryId, disciplineId, subjectId, mode: input.mode === "CYCLE" ? StudySessionMode.CYCLE : StudySessionMode.AVULSO, pausedAt: new Date() } });
      return this.dto(tx, active.id);
    });
  }

  private async currentInTransaction(tx: Prisma.TransactionClient, userId: string, studyGuideId: string) {
    const state = await tx.studyGuideCycleState.upsert({ where: { studyGuideId }, create: { userId, studyGuideId }, update: {} });
    const entries = await tx.cycleEntry.findMany({ where: { userId, studyGuideId, active: true }, include: { discipline: true, subject: { include: { discipline: true } } }, orderBy: { orderIndex: "asc" } });
    const eligibleEntries = entries.filter((value) => (value.discipline ?? value.subject?.discipline)?.active);
    const entry = eligibleEntries.find((value) => value.orderIndex >= state.currentOrderIndex) ?? eligibleEntries[0]; const discipline = entry?.discipline ?? entry?.subject?.discipline; if (!entry || !discipline) return null;
    const subjects = await tx.subject.findMany({ where: { userId, studyGuideId, disciplineId: discipline.id, active: true }, include: { progress: true }, orderBy: { sortOrder: "asc" } });
    const selected = selectWeightedSubject(subjects.map(toEngine));
    return selected ? { entry: { ...entry, disciplineId: discipline.id, discipline }, subject: selected } : null;
  }

  async pause(userId: string, studyGuideId: string, id: string, version: number) { return this.transition(userId, studyGuideId, id, version, ActiveStudySessionStatus.ACTIVE, ActiveStudySessionStatus.PAUSED); }
  async resume(userId: string, studyGuideId: string, id: string, version: number) { return this.transition(userId, studyGuideId, id, version, ActiveStudySessionStatus.PAUSED, ActiveStudySessionStatus.ACTIVE); }
  private async transition(userId: string, studyGuideId: string, id: string, version: number, expected: ActiveStudySessionStatus, next: ActiveStudySessionStatus) {
    const existing = await prisma.activeStudySession.findFirst({ where: { id, userId, studyGuideId } });
    if (!existing) throw new CycleConflictError("Sessão desatualizada ou alterada em outro dispositivo.", "SESSION_STATE_CHANGED");
    if (existing.status === next && existing.version === version + 1) return this.dto(prisma, id);
    if (existing.status !== expected) throw new CycleConflictError("Sessão desatualizada ou alterada em outro dispositivo.", "SESSION_STATE_CHANGED");
    const total = elapsedSeconds(existing); const result = await prisma.activeStudySession.updateMany({ where: { id, version, status: expected }, data: { status: next, accumulatedSeconds: total, pausedAt: next === ActiveStudySessionStatus.ACTIVE ? new Date() : null, version: { increment: 1 } } });
    if (result.count !== 1) throw new CycleConflictError("A sessão foi alterada em outro dispositivo.", "SESSION_VERSION_CHANGED"); return this.dto(prisma, id);
  }

  async cancel(userId: string, studyGuideId: string, id: string, version: number) {
    const existing = await prisma.activeStudySession.findFirst({ where: { id, userId, studyGuideId } });
    if (existing?.status === ActiveStudySessionStatus.CANCELLED && existing.version === version + 1) return { cancelled: true, idempotent: true };
    const result = await prisma.activeStudySession.updateMany({ where: { id, userId, studyGuideId, version, status: { in: [ActiveStudySessionStatus.ACTIVE, ActiveStudySessionStatus.PAUSED] } }, data: { status: ActiveStudySessionStatus.CANCELLED, cancelledAt: new Date(), version: { increment: 1 } } });
    if (!result.count) throw new CycleConflictError("Sessão desatualizada ou já encerrada.", "SESSION_VERSION_CHANGED"); return { cancelled: true };
  }

  async finish(userId: string, studyGuideId: string, id: string, version: number, input: { questions: number; correct: number; minutes?: number; notes?: string }) {
    if (input.questions <= 0 || input.correct > input.questions || input.correct < 0) throw new Error("Informe ao menos uma questão e valores válidos de acertos e erros.");
    return prisma.$transaction(async (tx) => {
      const active = await tx.activeStudySession.findFirst({ where: { id, userId, studyGuideId } , include: { completedSession: true } });
      if (!active) throw new Error("Sessão não encontrada.");
      if (active.completedSession) {
        const sameResult = active.completedSession.questions === input.questions && active.completedSession.correct === input.correct && (input.minutes === undefined || active.completedSession.estimatedMinutes === input.minutes) && (input.notes === undefined || active.completedSession.notes === input.notes);
        if (!sameResult) throw new CycleConflictError("Esta sessão já foi finalizada em outro dispositivo com dados diferentes.", "SESSION_FINISHED_WITH_DIFFERENT_DATA");
        return { sessionId: active.completedSession.id, idempotent: true };
      }
      if (!([ActiveStudySessionStatus.ACTIVE, ActiveStudySessionStatus.PAUSED] as ActiveStudySessionStatus[]).includes(active.status) || active.version !== version) throw new CycleConflictError("A sessão já foi processada ou possui uma versão mais recente.", "SESSION_VERSION_CHANGED");
      const locked = await tx.activeStudySession.updateMany({ where: { id, version, status: active.status }, data: { status: ActiveStudySessionStatus.FINISHING, version: { increment: 1 } } }); if (!locked.count) throw new CycleConflictError("Outra finalização venceu a concorrência.", "CONCURRENT_FINISH");
      const wrong = input.questions - input.correct; const minutes = input.minutes ?? Math.max(1, Math.round(elapsedSeconds(active) / 60));
      const created = await tx.studySession.create({ data: { userId, studyGuideId, cycleEntryId: active.cycleEntryId!, subjectId: active.subjectId, cyclePosition: active.mode === StudySessionMode.CYCLE ? active.cycleEntryId ? (await tx.cycleEntry.findUnique({ where: { id: active.cycleEntryId }, select: { orderIndex: true } }))?.orderIndex : null : null, date: new Date(), questions: input.questions, correct: input.correct, wrong, percentage: input.questions ? (input.correct / input.questions) * 100 : 0, estimatedMinutes: minutes, notes: input.notes, activeStudySessionId: active.id } });
      await this.updateProgress(tx, userId, studyGuideId, active.subjectId, input.questions, input.correct, wrong, active.mode === StudySessionMode.CYCLE);
      await tx.reviewSchedule.createMany({ data: [1, 7, 30].map((intervalDays) => ({ userId, studyGuideId, subjectId: active.subjectId, sourceSessionId: created.id, intervalDays, dueAt: new Date(Date.now() + intervalDays * 86_400_000) })) });
      if (active.mode === StudySessionMode.CYCLE) await this.advanceCursor(tx, userId, studyGuideId, active.cycleEntryId!);
      await tx.activeStudySession.update({ where: { id }, data: { status: ActiveStudySessionStatus.FINISHED, completedAt: new Date(), accumulatedSeconds: Math.max(active.accumulatedSeconds, minutes * 60), pausedAt: null, version: { increment: 1 } } });
      return { sessionId: created.id, idempotent: false };
    });
  }

  private async updateProgress(tx: Prisma.TransactionClient, userId: string, studyGuideId: string, subjectId: string, questions: number, correct: number, wrong: number, cycleMode: boolean) {
    const chosen = await tx.subject.findUnique({ where: { id: subjectId }, include: { progress: true } }); if (!chosen) throw new Error("Assunto não encontrado.");
    if (cycleMode) { const all = await tx.subject.findMany({ where: { userId, studyGuideId, disciplineId: chosen.disciplineId, active: true }, include: { progress: true } }); const next = advanceWeightedState(all.map(toEngine), subjectId); await Promise.all(next.map((item) => tx.subjectProgress.upsert({ where: { subjectId: item.id }, create: { userId, studyGuideId, subjectId: item.id, currentWeight: item.currentWeight }, update: { currentWeight: item.currentWeight } }))); }
    const prior = chosen.progress; const total = (prior?.totalQuestions ?? 0) + questions; const hits = (prior?.correct ?? 0) + correct;
    await tx.subjectProgress.upsert({ where: { subjectId }, create: { userId, studyGuideId, subjectId, passages: 1, totalQuestions: questions, correct, wrong, averagePercentage: questions ? correct / questions * 100 : 0, lastStudiedAt: new Date() }, update: { passages: { increment: 1 }, totalQuestions: total, correct: hits, wrong: (prior?.wrong ?? 0) + wrong, averagePercentage: total ? hits / total * 100 : 0, lastStudiedAt: new Date() } });
  }

  private async advanceCursor(tx: Prisma.TransactionClient, userId: string, studyGuideId: string, entryId: string) {
    const [entry, state, last] = await Promise.all([tx.cycleEntry.findUnique({ where: { id: entryId }, select: { orderIndex: true } }), tx.studyGuideCycleState.findUnique({ where: { studyGuideId } }), tx.cycleEntry.findFirst({ where: { userId, studyGuideId, active: true }, orderBy: { orderIndex: "desc" }, select: { orderIndex: true } })]);
    if (!entry || !state) throw new Error("Estado do ciclo não encontrado."); const wrap = entry.orderIndex >= (last?.orderIndex ?? entry.orderIndex); const updated = await tx.studyGuideCycleState.updateMany({ where: { id: state.id, version: state.version }, data: { currentOrderIndex: wrap ? 1 : entry.orderIndex + 1, ...(wrap ? { roundNumber: { increment: 1 } } : {}), version: { increment: 1 } } }); if (!updated.count) throw new CycleConflictError("O cursor do ciclo foi alterado em outro dispositivo.", "CYCLE_VERSION_CHANGED");
  }
}

export const cycleService = new CycleService();
