"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { EMPTY_TIER, type GoalTargets } from "@/lib/daily-goals";
import { ensureDailyGoalSettings } from "@/lib/daily-goals-service";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { ensureStudyGuideSettings, upsertStudyGuideSettings } from "@/lib/study-guide-settings";

function refreshGoals() {
  revalidatePath("/metas");
  revalidatePath("/dashboard");
}

const configSchema = z.object({
  dailyMinutes: z.coerce.number().int().min(10).max(720),
  weeklyQuestions: z.coerce.number().int().min(0).max(5000),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  activeWeekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1),
});

export async function updateDailyGoalSettings(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const parsed = configSchema.safeParse({
    dailyMinutes: formData.get("dailyMinutes"),
    weeklyQuestions: formData.get("weeklyQuestions"),
    examDate: String(formData.get("examDate") ?? ""),
    activeWeekdays: formData.getAll("activeWeekdays"),
  });
  if (!parsed.success) throw new Error("Informe dias, minutos e questões válidos.");
  const dailyQuestions = parsed.data.weeklyQuestions ? Math.ceil(parsed.data.weeklyQuestions / parsed.data.activeWeekdays.length) : 0;
  const tier = (minutes: number, questions: number): GoalTargets["target"] => ({ ...EMPTY_TIER, minutes, questions });
  const mainTargets: GoalTargets = {
    minimum: tier(Math.max(10, Math.round(parsed.data.dailyMinutes * 0.5)), 0),
    target: tier(parsed.data.dailyMinutes, dailyQuestions),
    excellent: tier(Math.round(parsed.data.dailyMinutes * 1.25), Math.round(dailyQuestions * 1.25)),
  };
  const current = await ensureDailyGoalSettings(user.id, guide.id);
  await prisma.dailyGoalSettings.updateMany({
    where: { id: current.id, userId: user.id, studyGuideId: guide.id },
    data: {
      firstStudyDeadline: null,
      includeMockExams: false,
      activeWeekdays: parsed.data.activeWeekdays,
      plannedRestWeekdays: [],
      enabledMetrics: ["minutes"],
      weekdayTargets: mainTargets as unknown as Prisma.InputJsonValue,
      saturdayTargets: mainTargets as unknown as Prisma.InputJsonValue,
      sundayTargets: mainTargets as unknown as Prisma.InputJsonValue,
    },
  });
  const guideSettings = await ensureStudyGuideSettings(user.id, guide.id);
  const examDate = parsed.data.examDate ? new Date(`${parsed.data.examDate}T12:00:00.000Z`) : null;
  await upsertStudyGuideSettings(user.id, guide.id, {
    targetPercentage: guideSettings.targetPercentage,
    dailyQuestionsGoal: dailyQuestions,
    weeklyQuestionsGoal: parsed.data.weeklyQuestions,
    weightPriorityBias: guideSettings.weightPriorityBias,
    examDate: examDate && !Number.isNaN(examDate.getTime()) ? examDate : null,
    sessionMinutes: guideSettings.sessionMinutes,
    questionsPerSession: guideSettings.questionsPerSession,
  });
  refreshGoals();
  revalidatePath("/planejamento");
  revalidatePath("/configuracoes");
}

export async function addManualDailyGoal(formData: FormData) {
  const user = await requireUser(); const guide = await requireActiveStudyGuide(user.id);
  const parsed = z.object({ title: z.string().trim().min(2).max(100), tier: z.enum(["MINIMUM", "MAIN"]) }).safeParse({ title: formData.get("title"), tier: formData.get("tier") });
  if (!parsed.success) throw new Error("Informe uma meta manual válida.");
  await prisma.manualDailyGoal.create({ data: { userId: user.id, studyGuideId: guide.id, ...parsed.data } });
  refreshGoals();
}

export async function toggleManualDailyGoal(formData: FormData) {
  const user = await requireUser(); const guide = await requireActiveStudyGuide(user.id);
  const goalId = String(formData.get("goalId") ?? ""); const dayKey = String(formData.get("dayKey") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error("Dia inválido.");
  const goal = await prisma.manualDailyGoal.findFirst({ where: { id: goalId, userId: user.id, studyGuideId: guide.id, active: true } });
  if (!goal) throw new Error("Meta não encontrada.");
  const existing = await prisma.manualDailyGoalCheck.findUnique({ where: { manualGoalId_dayKey: { manualGoalId: goal.id, dayKey } } });
  if (existing) await prisma.manualDailyGoalCheck.delete({ where: { id: existing.id } });
  else await prisma.manualDailyGoalCheck.create({ data: { userId: user.id, studyGuideId: guide.id, manualGoalId: goal.id, dayKey } });
  refreshGoals();
}

export async function saveDailyReflection(formData: FormData) {
  const user = await requireUser(); const guide = await requireActiveStudyGuide(user.id);
  const parsed = z.object({ dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mood: z.enum(["LEVE", "BOM", "DIFICIL"]).optional(), whatWorked: z.string().trim().max(500), adjustTomorrow: z.string().trim().max(500) }).safeParse({ dayKey: formData.get("dayKey"), mood: formData.get("mood") || undefined, whatWorked: String(formData.get("whatWorked") ?? ""), adjustTomorrow: String(formData.get("adjustTomorrow") ?? "") });
  if (!parsed.success) throw new Error("Reflexão inválida.");
  await prisma.dailyReflection.upsert({ where: { userId_studyGuideId_dayKey: { userId: user.id, studyGuideId: guide.id, dayKey: parsed.data.dayKey } }, create: { userId: user.id, studyGuideId: guide.id, ...parsed.data }, update: { mood: parsed.data.mood, whatWorked: parsed.data.whatWorked || null, adjustTomorrow: parsed.data.adjustTomorrow || null, closedAt: new Date() } });
  refreshGoals();
}
