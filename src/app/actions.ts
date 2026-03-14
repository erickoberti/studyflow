"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  requireActiveStudyGuide,
  setActiveStudyGuide,
  STUDY_GUIDE_COLORS,
  STUDY_GUIDE_ICONS,
} from "@/lib/study-guide";
import { ensureStudyGuideSettings } from "@/lib/study-guide-settings";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function registerUser(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: "Dados invalidos." };
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    return { ok: false, message: "Email ja cadastrado." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      settings: {
        create: {},
      },
    },
  });

  return { ok: true, message: "Conta criada com sucesso." };
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { ok: true, message: "Se o email existir, um token sera gerado." };
  }

  const token = crypto.randomUUID();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });

  return {
    ok: true,
    message: `Token gerado: ${token}`,
  };
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    return { ok: false, message: "Senha deve ter pelo menos 6 caracteres." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { ok: false, message: "Token invalido ou expirado." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return { ok: true, message: "Senha alterada com sucesso." };
}

export async function signOutAction() {
  redirect("/api/auth/signout");
}

export async function createDiscipline(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const name = String(formData.get("name") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : null;
  if (!name) return;

  await prisma.discipline.create({
    data: {
      userId: user.id,
      studyGuideId: guide.id,
      name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
      category: null,
    },
  });

  revalidatePath("/base");
}

export async function updateDiscipline(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : null;

  if (!disciplineId || !name) return;

  await prisma.discipline.updateMany({
    where: { id: disciplineId, userId: user.id, studyGuideId: guide.id },
    data: {
      name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
    },
  });

  revalidatePath("/base");
  revalidatePath("/guias");
}

export async function createSubject(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const weight = Number(formData.get("weight") ?? 1);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tecReference = String(formData.get("tecReference") ?? "").trim() || null;
  if (!name || !disciplineId) return;

  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, userId: user.id, studyGuideId: guide.id },
    select: { id: true },
  });
  if (!discipline) return;

  await prisma.subject.create({
    data: {
      userId: user.id,
      studyGuideId: guide.id,
      disciplineId,
      name,
      weight,
      notes,
      tecReference,
      groupName: null,
      active: true,
    },
  });

  revalidatePath("/base");
  revalidatePath("/ciclo");
}

export async function addCycleEntry(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!subjectId) return;

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id, studyGuideId: guide.id },
    select: { id: true },
  });
  if (!subject) return;

  const last = await prisma.cycleEntry.findFirst({
    where: { userId: user.id, studyGuideId: guide.id },
    orderBy: { orderIndex: "desc" },
  });

  await prisma.cycleEntry.create({
    data: {
      userId: user.id,
      studyGuideId: guide.id,
      subjectId,
      orderIndex: (last?.orderIndex ?? 0) + 1,
      active: true,
    },
  });

  revalidatePath("/ciclo");
  revalidatePath("/registro");
}

export async function duplicateCycleEntry(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  const entry = await prisma.cycleEntry.findFirst({ where: { id: entryId, userId: user.id, studyGuideId: guide.id } });
  if (!entry) return;

  await prisma.$transaction(async (tx) => {
    await tx.cycleEntry.updateMany({
      where: { userId: user.id, studyGuideId: guide.id, orderIndex: { gt: entry.orderIndex } },
      data: { orderIndex: { increment: 1 } },
    });

    await tx.cycleEntry.create({
      data: {
        userId: user.id,
        studyGuideId: guide.id,
        subjectId: entry.subjectId,
        orderIndex: entry.orderIndex + 1,
        active: entry.active,
      },
    });
  });

  revalidatePath("/ciclo");
  revalidatePath("/registro");
}

export async function moveCycleEntry(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const entryId = String(formData.get("entryId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const entry = await prisma.cycleEntry.findFirst({ where: { id: entryId, userId: user.id, studyGuideId: guide.id } });
  if (!entry) return;

  const swapOrder = direction === "up" ? entry.orderIndex - 1 : entry.orderIndex + 1;
  if (swapOrder < 1) return;

  const swap = await prisma.cycleEntry.findFirst({
    where: { userId: user.id, studyGuideId: guide.id, orderIndex: swapOrder },
  });

  if (!swap) return;

  const tempOrderIndex = -entry.orderIndex;

  await prisma.$transaction(async (tx) => {
    // Avoid unique collision on (userId, orderIndex) while swapping.
    await tx.cycleEntry.update({
      where: { id: entry.id },
      data: { orderIndex: tempOrderIndex },
    });

    await tx.cycleEntry.update({
      where: { id: swap.id },
      data: { orderIndex: entry.orderIndex },
    });

    await tx.cycleEntry.update({
      where: { id: entry.id },
      data: { orderIndex: swap.orderIndex },
    });
  });

  revalidatePath("/ciclo");
  revalidatePath("/registro");
}

export async function toggleCycleEntry(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const entryId = String(formData.get("entryId") ?? "");

  const entry = await prisma.cycleEntry.findFirst({ where: { id: entryId, userId: user.id, studyGuideId: guide.id } });
  if (!entry) return;

  await prisma.cycleEntry.update({
    where: { id: entry.id },
    data: { active: !entry.active },
  });

  revalidatePath("/ciclo");
  revalidatePath("/registro");
}

export async function deleteCycleEntry(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const entryId = String(formData.get("entryId") ?? "");

  const entry = await prisma.cycleEntry.findFirst({ where: { id: entryId, userId: user.id, studyGuideId: guide.id } });
  if (!entry) return;

  await prisma.$transaction(async (tx) => {
    await tx.studySession.deleteMany({ where: { cycleEntryId: entry.id, userId: user.id, studyGuideId: guide.id } });
    await tx.cycleEntry.delete({ where: { id: entry.id } });
    await tx.cycleEntry.updateMany({
      where: { userId: user.id, studyGuideId: guide.id, orderIndex: { gt: entry.orderIndex } },
      data: { orderIndex: { decrement: 1 } },
    });
  });

  revalidatePath("/ciclo");
  revalidatePath("/registro");
}

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);

  await ensureStudyGuideSettings(user.id, guide.id);

  await prisma.studyGuideSettings.upsert({
    where: { studyGuideId: guide.id },
    create: {
      userId: user.id,
      studyGuideId: guide.id,
      targetPercentage: Number(formData.get("targetPercentage") ?? 80),
      dailyQuestionsGoal: Number(formData.get("dailyQuestionsGoal") ?? 30),
      weeklyQuestionsGoal: Number(formData.get("weeklyQuestionsGoal") ?? 200),
      weightPriorityBias: Number(formData.get("weightPriorityBias") ?? 1.25),
    },
    update: {
      targetPercentage: Number(formData.get("targetPercentage") ?? 80),
      dailyQuestionsGoal: Number(formData.get("dailyQuestionsGoal") ?? 30),
      weeklyQuestionsGoal: Number(formData.get("weeklyQuestionsGoal") ?? 200),
      weightPriorityBias: Number(formData.get("weightPriorityBias") ?? 1.25),
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      targetPercentage: Number(formData.get("targetPercentage") ?? 80),
      dailyQuestionsGoal: Number(formData.get("dailyQuestionsGoal") ?? 30),
      weeklyQuestionsGoal: Number(formData.get("weeklyQuestionsGoal") ?? 200),
      weightPriorityBias: Number(formData.get("weightPriorityBias") ?? 1.25),
      theme: String(formData.get("theme") ?? "system"),
    },
    update: {
      targetPercentage: Number(formData.get("targetPercentage") ?? 80),
      dailyQuestionsGoal: Number(formData.get("dailyQuestionsGoal") ?? 30),
      weeklyQuestionsGoal: Number(formData.get("weeklyQuestionsGoal") ?? 200),
      weightPriorityBias: Number(formData.get("weightPriorityBias") ?? 1.25),
      theme: String(formData.get("theme") ?? "system"),
    },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/dashboard");
}

export async function ensureAuthenticated() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login");
  }
}

export async function createStudyGuideAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "book-open");
  const color = String(formData.get("color") ?? "#6366f1");

  if (!name) return;

  const guide = await prisma.studyGuide.create({
    data: {
      userId: user.id,
      name,
      icon: STUDY_GUIDE_ICONS.includes(icon as (typeof STUDY_GUIDE_ICONS)[number]) ? icon : "book-open",
      color: STUDY_GUIDE_COLORS.includes(color as (typeof STUDY_GUIDE_COLORS)[number]) ? color : "#6366f1",
      description,
      settings: {
        create: {
          userId: user.id,
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { activeStudyGuideId: guide.id },
  });

  redirect("/guias");
}

export async function selectStudyGuideAction(formData: FormData) {
  const user = await requireUser();
  const studyGuideId = String(formData.get("studyGuideId") ?? "");
  if (!studyGuideId) return;

  const ok = await setActiveStudyGuide(user.id, studyGuideId);
  if (!ok) return;

  redirect("/guias");
}

export async function updateStudyGuideAction(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? guide.icon);
  const color = String(formData.get("color") ?? guide.color);

  if (!name) return;

  await prisma.studyGuide.update({
    where: { id: guide.id },
    data: {
      name,
      description,
      icon: STUDY_GUIDE_ICONS.includes(icon as (typeof STUDY_GUIDE_ICONS)[number]) ? icon : guide.icon,
      color: STUDY_GUIDE_COLORS.includes(color as (typeof STUDY_GUIDE_COLORS)[number]) ? color : guide.color,
    },
  });

  revalidatePath("/guias");
  revalidatePath("/dashboard");
}

export async function deleteStudyGuideAction(formData: FormData) {
  const user = await requireUser();
  const guideId = String(formData.get("studyGuideId") ?? "");
  if (!guideId) return;

  const guides = await prisma.studyGuide.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (guides.length <= 1) return;

  const target = guides.find((guide) => guide.id === guideId);
  if (!target) return;

  const fallbackGuide = guides.find((guide) => guide.id !== guideId);

  await prisma.$transaction(async (tx) => {
    if (fallbackGuide) {
      await tx.user.update({
        where: { id: user.id },
        data: { activeStudyGuideId: fallbackGuide.id },
      });
    }

    await tx.studyGuide.delete({
      where: { id: guideId },
    });
  });

  revalidatePath("/guias");
  revalidatePath("/dashboard");
  redirect("/guias");
}

export async function createGuideDisciplineAction(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!name) return;

  await prisma.discipline.create({
    data: {
      userId: user.id,
      studyGuideId: guide.id,
      name,
      sortOrder: null,
      category,
      active: true,
    },
  });

  revalidatePath("/guias");
  revalidatePath("/base");
}

export async function updateGuideDisciplineAction(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!disciplineId || !name) return;

  await prisma.discipline.updateMany({
    where: { id: disciplineId, userId: user.id, studyGuideId: guide.id },
    data: { name, category },
  });

  revalidatePath("/guias");
  revalidatePath("/base");
}

export async function toggleGuideDisciplineAction(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  if (!disciplineId) return;

  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, userId: user.id, studyGuideId: guide.id },
    select: { id: true, active: true },
  });
  if (!discipline) return;

  await prisma.discipline.update({
    where: { id: discipline.id },
    data: { active: !discipline.active },
  });

  revalidatePath("/guias");
  revalidatePath("/base");
  revalidatePath("/registro");
  revalidatePath("/ciclo");
}

export async function deleteGuideDisciplineAction(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  if (!disciplineId) return;

  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, userId: user.id, studyGuideId: guide.id },
    select: {
      id: true,
      _count: {
        select: {
          subjects: true,
        },
      },
    },
  });
  if (!discipline) return;

  // Never remove a discipline that already owns subject data.
  if (discipline._count.subjects > 0) return;

  await prisma.discipline.delete({
    where: { id: discipline.id },
  });

  revalidatePath("/guias");
  revalidatePath("/base");
  revalidatePath("/registro");
  revalidatePath("/ciclo");
}

