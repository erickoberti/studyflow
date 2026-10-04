import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudyGuideSettings, upsertStudyGuideSettings } from "@/lib/study-guide-settings";
import { structuralOperationKeys, type StructuralOperationResult } from "@/lib/offline/structural-sync-result";

type PendingOperation = {
  id: string;
  entity: "guide" | "discipline" | "subject" | "settings" | "guide-selection";
  action: "create" | "update" | "delete" | "upsert" | "select";
  payload: Record<string, unknown>;
  createdAt: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function upsertPrimaryCycleEntry(userId: string, studyGuideId: string, subjectId: string, orderIndex: number | null) {
  const existing = await prisma.cycleEntry.findFirst({
    where: { userId, studyGuideId, subjectId },
    orderBy: { orderIndex: "asc" },
  });

  if (!orderIndex || orderIndex <= 0) {
    if (existing) {
      await prisma.cycleEntry.delete({ where: { id: existing.id } });
    }
    return;
  }

  const targetOrder = Math.max(1, Math.floor(orderIndex));

  if (!existing) {
    await prisma.$transaction(async (tx) => {
      await tx.cycleEntry.updateMany({
        where: { userId, studyGuideId, orderIndex: { gte: targetOrder } },
        data: { orderIndex: { increment: 1 } },
      });

      await tx.cycleEntry.create({
        data: {
          userId,
          studyGuideId,
          subjectId,
          orderIndex: targetOrder,
          active: true,
        },
      });
    });
    return;
  }

  if (existing.orderIndex === targetOrder) {
    await prisma.cycleEntry.update({
      where: { id: existing.id },
      data: { active: true },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.cycleEntry.update({
      where: { id: existing.id },
      data: { orderIndex: -1, active: true },
    });

    if (targetOrder < existing.orderIndex) {
      await tx.cycleEntry.updateMany({
        where: {
          userId,
          studyGuideId,
          orderIndex: { gte: targetOrder, lt: existing.orderIndex },
        },
        data: { orderIndex: { increment: 1 } },
      });
    } else {
      await tx.cycleEntry.updateMany({
        where: {
          userId,
          studyGuideId,
          orderIndex: { gt: existing.orderIndex, lte: targetOrder },
        },
        data: { orderIndex: { decrement: 1 } },
      });
    }

    await tx.cycleEntry.update({
      where: { id: existing.id },
      data: { orderIndex: targetOrder },
    });
  });
}

class RejectedOperationError extends Error {}

async function executeStructuralOperation(userId: string, operation: PendingOperation, clientIdMap: Map<string, string>): Promise<Omit<StructuralOperationResult, "id">> {
  const resolveId = (value: unknown) => clientIdMap.get(asString(value)) ?? asString(value);
  const ownsGuide = (guideId: string) => prisma.studyGuide.count({ where: { id: guideId, userId } });
  const ownsDiscipline = (disciplineId: string, guideId: string | null) => prisma.discipline.count({
    where: { id: disciplineId, userId, studyGuideId: guideId },
  });
  const input = operation.payload;

  if (operation.entity === "guide" && operation.action === "create") {
    const clientId = asString(input.clientId);
    if (!clientId) throw new RejectedOperationError("ID local do guia ausente.");
    let guide = await prisma.studyGuide.findUnique({ where: { id: clientId } });
    let alreadyProcessed = Boolean(guide);
    if (!guide) {
      try {
        guide = await prisma.studyGuide.create({
          data: { id: clientId, userId, name: asString(input.name), description: asNullableString(input.description), icon: asString(input.icon) || "book-open", color: asString(input.color) || "#6366f1" },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        guide = await prisma.studyGuide.findUnique({ where: { id: clientId } });
        if (!guide) throw error;
        alreadyProcessed = true;
      }
    }
    if (guide.userId !== userId) throw new RejectedOperationError("O guia pertence a outra conta.");
    await ensureStudyGuideSettings(userId, guide.id);
    clientIdMap.set(clientId, guide.id);
    return { status: alreadyProcessed ? "already_processed" : "completed", serverId: guide.id };
  }

  if (operation.entity === "guide" && operation.action === "update") {
    const id = resolveId(input.id);
    const updated = await prisma.studyGuide.updateMany({
      where: { id, userId },
      data: { name: asString(input.name), description: asNullableString(input.description), icon: asString(input.icon) || "book-open", color: asString(input.color) || "#6366f1" },
    });
    if (!updated.count) throw new RejectedOperationError("Guia não encontrado nesta conta.");
    return { status: "completed" };
  }

  if (operation.entity === "guide" && operation.action === "delete") {
    const id = resolveId(input.id);
    if (!id) throw new RejectedOperationError("ID do guia ausente.");
    const guide = await prisma.studyGuide.findUnique({ where: { id }, select: { userId: true } });
    if (!guide) return { status: "already_processed" };
    if (guide.userId !== userId) throw new RejectedOperationError("O guia pertence a outra conta.");
    const deleted = await prisma.studyGuide.deleteMany({ where: { id, userId } });
    return { status: deleted.count ? "completed" : "already_processed" };
  }

  if (operation.entity === "guide-selection" && operation.action === "select") {
    const id = resolveId(input.id);
    if (!(await ownsGuide(id))) throw new RejectedOperationError("Guia selecionado não pertence à conta.");
    await prisma.user.update({ where: { id: userId }, data: { activeStudyGuideId: id } });
    return { status: "completed" };
  }

  if (operation.entity === "discipline" && operation.action === "create") {
    const clientId = asString(input.clientId);
    const guideId = resolveId(input.guideId);
    if (!clientId || !(await ownsGuide(guideId))) throw new RejectedOperationError("Guia ou ID local da disciplina inválido.");
    let discipline = await prisma.discipline.findUnique({ where: { id: clientId } });
    let alreadyProcessed = Boolean(discipline);
    if (!discipline) {
      try {
        discipline = await prisma.discipline.create({
          data: { id: clientId, userId, studyGuideId: guideId, name: asString(input.name), category: asNullableString(input.category), sortOrder: input.sortOrder == null ? null : asNumber(input.sortOrder), active: true },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        discipline = await prisma.discipline.findUnique({ where: { id: clientId } });
        if (!discipline) throw error;
        alreadyProcessed = true;
      }
    }
    if (discipline.userId !== userId || discipline.studyGuideId !== guideId) throw new RejectedOperationError("Disciplina pertence a outro contexto.");
    clientIdMap.set(clientId, discipline.id);
    return { status: alreadyProcessed ? "already_processed" : "completed", serverId: discipline.id };
  }

  if (operation.entity === "discipline" && operation.action === "update") {
    const id = resolveId(input.id);
    const updated = await prisma.discipline.updateMany({
      where: { id, userId },
      data: { name: asString(input.name), category: asNullableString(input.category), sortOrder: input.sortOrder == null ? null : asNumber(input.sortOrder), active: Boolean(input.active) },
    });
    if (!updated.count) throw new RejectedOperationError("Disciplina não encontrada nesta conta.");
    return { status: "completed" };
  }

  if (operation.entity === "discipline" && operation.action === "delete") {
    const id = resolveId(input.id);
    if (!id) throw new RejectedOperationError("ID da disciplina ausente.");
    const discipline = await prisma.discipline.findUnique({ where: { id }, select: { userId: true } });
    if (!discipline) return { status: "already_processed" };
    if (discipline.userId !== userId) throw new RejectedOperationError("Disciplina pertence a outra conta.");
    const deleted = await prisma.discipline.deleteMany({ where: { id, userId } });
    return { status: deleted.count ? "completed" : "already_processed" };
  }

  if (operation.entity === "subject" && operation.action === "create") {
    const clientId = asString(input.clientId);
    const guideId = resolveId(input.guideId);
    const disciplineId = resolveId(input.disciplineId);
    if (!clientId || !(await ownsGuide(guideId))) throw new RejectedOperationError("Guia ou ID local do assunto inválido.");
    let subject = await prisma.subject.findUnique({ where: { id: clientId } });
    let alreadyProcessed = Boolean(subject);
    if (!subject) {
      if (!(await ownsDiscipline(disciplineId, guideId))) throw new RejectedOperationError("Disciplina não pertence ao guia do assunto.");
      try {
        subject = await prisma.subject.create({
          data: { id: clientId, userId, studyGuideId: guideId, disciplineId, name: asString(input.name), weight: asNumber(input.weight, 1), notes: asNullableString(input.notes), tecReference: asNullableString(input.tecReference), active: true },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        subject = await prisma.subject.findUnique({ where: { id: clientId } });
        if (!subject) throw error;
        alreadyProcessed = true;
      }
    }
    if (subject.userId !== userId || subject.studyGuideId !== guideId) {
      throw new RejectedOperationError("Assunto pertence a outro contexto.");
    }
    const existingPosition = alreadyProcessed ? await prisma.cycleEntry.count({ where: { userId, studyGuideId: guideId, subjectId: subject.id } }) : 0;
    if (!alreadyProcessed || (!existingPosition && asNumber(input.orderIndex) > 0)) {
      await upsertPrimaryCycleEntry(userId, guideId, subject.id, input.orderIndex == null ? null : asNumber(input.orderIndex));
    }
    clientIdMap.set(clientId, subject.id);
    return { status: alreadyProcessed ? "already_processed" : "completed", serverId: subject.id };
  }

  if (operation.entity === "subject" && operation.action === "update") {
    const subjectId = resolveId(input.id);
    const disciplineId = resolveId(input.disciplineId);
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { studyGuideId: true } });
    if (!subject) throw new RejectedOperationError("Assunto não encontrado nesta conta.");
    if (!(await ownsDiscipline(disciplineId, subject.studyGuideId))) throw new RejectedOperationError("Disciplina não pertence ao guia do assunto.");
    await prisma.subject.updateMany({
      where: { id: subjectId, userId },
      data: { disciplineId, name: asString(input.name), weight: asNumber(input.weight, 1), notes: asNullableString(input.notes), tecReference: asNullableString(input.tecReference), active: Boolean(input.active) },
    });
    await upsertPrimaryCycleEntry(userId, subject.studyGuideId ?? "", subjectId, input.orderIndex == null ? null : asNumber(input.orderIndex));
    return { status: "completed" };
  }

  if (operation.entity === "settings" && operation.action === "upsert") {
    const guideId = resolveId(input.guideId);
    if (!guideId || !(await ownsGuide(guideId))) throw new RejectedOperationError("Guia das configurações não pertence à conta.");
    await upsertStudyGuideSettings(userId, guideId, {
      targetPercentage: asNumber(input.targetPercentage, 80),
      dailyQuestionsGoal: asNumber(input.dailyQuestionsGoal, 30),
      weeklyQuestionsGoal: asNumber(input.weeklyQuestionsGoal, 200),
      weightPriorityBias: asNumber(input.weightPriorityBias, 1.25),
    });
    return { status: "completed" };
  }

  throw new RejectedOperationError("Operação estrutural não suportada.");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.operations)) return NextResponse.json({ message: "Lote inválido." }, { status: 400 });
  const operations = body.operations as PendingOperation[];
  const ids = new Set<string>();
  for (const operation of operations) {
    if (!operation || typeof operation.id !== "string" || !operation.id || ids.has(operation.id) || typeof operation.createdAt !== "string" || !operation.payload || typeof operation.payload !== "object" || Array.isArray(operation.payload)) {
      return NextResponse.json({ message: "Operação estrutural inválida ou repetida no lote." }, { status: 400 });
    }
    ids.add(operation.id);
  }

  const userId = session.user.id;
  const clientIdMap = new Map<string, string>();
  const blockedKeys = new Set<string>();
  const results: StructuralOperationResult[] = [];
  for (const operation of [...operations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const { target, references } = structuralOperationKeys(operation);
    if (references.some((key) => blockedKeys.has(key))) {
      results.push({ id: operation.id, status: "blocked", message: "Aguardando operação estrutural anterior." });
      continue;
    }
    try {
      const outcome = await executeStructuralOperation(userId, operation, clientIdMap);
      results.push({ id: operation.id, ...outcome });
    } catch (error) {
      const rejected = error instanceof RejectedOperationError;
      results.push({ id: operation.id, status: rejected ? "rejected" : "error", message: rejected && error instanceof Error ? error.message : "Falha ao processar operação; tente novamente." });
      blockedKeys.add(target);
    }
  }
  return NextResponse.json({ ok: results.every((result) => result.status === "completed" || result.status === "already_processed"), userId, results });
}
