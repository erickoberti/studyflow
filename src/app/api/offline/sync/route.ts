import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudyGuideSettings, upsertStudyGuideSettings } from "@/lib/study-guide-settings";

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const operations = Array.isArray(payload.operations) ? (payload.operations as PendingOperation[]) : [];
  const clientIdMap = new Map<string, string>();

  for (const operation of operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (operation.entity === "guide" && operation.action === "create") {
      const created = await prisma.studyGuide.create({
        data: {
          userId: session.user.id,
          name: asString(operation.payload.name),
          description: asNullableString(operation.payload.description),
          icon: asString(operation.payload.icon) || "book-open",
          color: asString(operation.payload.color) || "#6366f1",
        },
      });
      await ensureStudyGuideSettings(session.user.id, created.id);
      clientIdMap.set(asString(operation.payload.clientId), created.id);
      continue;
    }

    if (operation.entity === "guide" && operation.action === "update") {
      const guideId = clientIdMap.get(asString(operation.payload.id)) ?? asString(operation.payload.id);
      await prisma.studyGuide.updateMany({
        where: { id: guideId, userId: session.user.id },
        data: {
          name: asString(operation.payload.name),
          description: asNullableString(operation.payload.description),
          icon: asString(operation.payload.icon) || "book-open",
          color: asString(operation.payload.color) || "#6366f1",
        },
      });
      continue;
    }

    if (operation.entity === "guide" && operation.action === "delete") {
      const guideId = clientIdMap.get(asString(operation.payload.id)) ?? asString(operation.payload.id);
      await prisma.studyGuide.deleteMany({
        where: { id: guideId, userId: session.user.id },
      });
      continue;
    }

    if (operation.entity === "guide-selection" && operation.action === "select") {
      const guideId = clientIdMap.get(asString(operation.payload.id)) ?? asString(operation.payload.id);
      await prisma.user.update({
        where: { id: session.user.id },
        data: { activeStudyGuideId: guideId },
      });
      continue;
    }

    if (operation.entity === "discipline" && operation.action === "create") {
      const guideId = clientIdMap.get(asString(operation.payload.guideId)) ?? asString(operation.payload.guideId);
      const created = await prisma.discipline.create({
        data: {
          userId: session.user.id,
          studyGuideId: guideId,
          name: asString(operation.payload.name),
          category: asNullableString(operation.payload.category),
          sortOrder: operation.payload.sortOrder == null ? null : asNumber(operation.payload.sortOrder),
          active: true,
        },
      });
      clientIdMap.set(asString(operation.payload.clientId), created.id);
      continue;
    }

    if (operation.entity === "discipline" && operation.action === "update") {
      const disciplineId = clientIdMap.get(asString(operation.payload.id)) ?? asString(operation.payload.id);
      await prisma.discipline.updateMany({
        where: { id: disciplineId, userId: session.user.id },
        data: {
          name: asString(operation.payload.name),
          category: asNullableString(operation.payload.category),
          sortOrder: operation.payload.sortOrder == null ? null : asNumber(operation.payload.sortOrder),
          active: Boolean(operation.payload.active),
        },
      });
      continue;
    }

    if (operation.entity === "discipline" && operation.action === "delete") {
      const disciplineId = clientIdMap.get(asString(operation.payload.id)) ?? asString(operation.payload.id);
      await prisma.discipline.deleteMany({
        where: { id: disciplineId, userId: session.user.id },
      });
      continue;
    }

    if (operation.entity === "subject" && operation.action === "create") {
      const guideId = clientIdMap.get(asString(operation.payload.guideId)) ?? asString(operation.payload.guideId);
      const disciplineId =
        clientIdMap.get(asString(operation.payload.disciplineId)) ?? asString(operation.payload.disciplineId);

      const created = await prisma.subject.create({
        data: {
          userId: session.user.id,
          studyGuideId: guideId,
          disciplineId,
          name: asString(operation.payload.name),
          weight: asNumber(operation.payload.weight, 1),
          notes: asNullableString(operation.payload.notes),
          tecReference: asNullableString(operation.payload.tecReference),
          active: true,
        },
      });

      await upsertPrimaryCycleEntry(
        session.user.id,
        guideId,
        created.id,
        operation.payload.orderIndex == null ? null : asNumber(operation.payload.orderIndex),
      );

      clientIdMap.set(asString(operation.payload.clientId), created.id);
      continue;
    }

    if (operation.entity === "subject" && operation.action === "update") {
      const subjectId = clientIdMap.get(asString(operation.payload.id)) ?? asString(operation.payload.id);
      const disciplineId =
        clientIdMap.get(asString(operation.payload.disciplineId)) ?? asString(operation.payload.disciplineId);

      const subject = await prisma.subject.findFirst({
        where: { id: subjectId, userId: session.user.id },
        select: { studyGuideId: true },
      });

      if (!subject) {
        continue;
      }

      await prisma.subject.updateMany({
        where: { id: subjectId, userId: session.user.id },
        data: {
          disciplineId,
          name: asString(operation.payload.name),
          weight: asNumber(operation.payload.weight, 1),
          notes: asNullableString(operation.payload.notes),
          tecReference: asNullableString(operation.payload.tecReference),
          active: Boolean(operation.payload.active),
        },
      });

      await upsertPrimaryCycleEntry(
        session.user.id,
        subject.studyGuideId ?? "",
        subjectId,
        operation.payload.orderIndex == null ? null : asNumber(operation.payload.orderIndex),
      );
      continue;
    }

    if (operation.entity === "settings" && operation.action === "upsert") {
      const guideId = clientIdMap.get(asString(operation.payload.guideId)) ?? asString(operation.payload.guideId);
      if (!guideId) continue;

      await upsertStudyGuideSettings(session.user.id, guideId, {
        targetPercentage: asNumber(operation.payload.targetPercentage, 80),
        dailyQuestionsGoal: asNumber(operation.payload.dailyQuestionsGoal, 30),
        weeklyQuestionsGoal: asNumber(operation.payload.weeklyQuestionsGoal, 200),
        weightPriorityBias: asNumber(operation.payload.weightPriorityBias, 1.25),
      });
      continue;
    }
  }

  return NextResponse.json({ ok: true });
}
