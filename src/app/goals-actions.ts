"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DAILY_GOAL_METRICS, type GoalTargets } from "@/lib/daily-goals";
import { ensureDailyGoalSettings } from "@/lib/daily-goals-service";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";

function refreshGoals() {
  revalidatePath("/metas");
  revalidatePath("/dashboard");
}

const nonNegative = z.coerce.number().int().min(0).max(1440);
const configSchema = z.object({
  timeZone: z.string().min(1).max(80),
  firstStudyDeadline: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")),
  includeMockExams: z.boolean(),
  activeWeekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1),
  plannedRestWeekdays: z.array(z.coerce.number().int().min(1).max(7)),
  enabledMetrics: z.array(z.enum(DAILY_GOAL_METRICS)),
  tiers: z.record(z.string(), nonNegative),
});

export async function updateDailyGoalSettings(formData: FormData) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const tierValues: Record<string, number> = {};
  for (const tier of ["minimum", "target", "excellent"]) for (const metric of DAILY_GOAL_METRICS) tierValues[`${tier}.${metric}`] = Number(formData.get(`${tier}.${metric}`) ?? 0);
  const parsed = configSchema.safeParse({
    timeZone: String(formData.get("timeZone") ?? "America/Sao_Paulo"),
    firstStudyDeadline: String(formData.get("firstStudyDeadline") ?? ""),
    includeMockExams: formData.get("includeMockExams") === "on",
    activeWeekdays: formData.getAll("activeWeekdays"),
    plannedRestWeekdays: formData.getAll("plannedRestWeekdays"),
    enabledMetrics: formData.getAll("enabledMetrics"),
    tiers: tierValues,
  });
  if (!parsed.success) throw new Error("Configuração de metas inválida.");
  const targets = (prefix: string): GoalTargets => ({
    minimum: Object.fromEntries(DAILY_GOAL_METRICS.map((metric) => [metric, parsed.data.tiers[`${prefix}minimum.${metric}`] ?? parsed.data.tiers[`minimum.${metric}`] ?? 0])) as GoalTargets["minimum"],
    target: Object.fromEntries(DAILY_GOAL_METRICS.map((metric) => [metric, parsed.data.tiers[`${prefix}target.${metric}`] ?? parsed.data.tiers[`target.${metric}`] ?? 0])) as GoalTargets["target"],
    excellent: Object.fromEntries(DAILY_GOAL_METRICS.map((metric) => [metric, parsed.data.tiers[`${prefix}excellent.${metric}`] ?? parsed.data.tiers[`excellent.${metric}`] ?? 0])) as GoalTargets["excellent"],
  });
  const current = await ensureDailyGoalSettings(user.id, guide.id);
  const mainTargets = targets("");
  if (parsed.data.enabledMetrics.includes("firstStudy") && parsed.data.firstStudyDeadline) mainTargets.target.firstStudy = 1;
  const weekendTargets = (day: "saturday" | "sunday") => {
    const result = structuredClone(mainTargets);
    for (const tier of ["minimum", "target", "excellent"] as const) for (const metric of DAILY_GOAL_METRICS) {
      const raw = formData.get(`${day}.${tier}.${metric}`);
      if (raw !== null && String(raw) !== "") result[tier][metric] = Math.max(0, Number(raw) || 0);
    }
    return result;
  };
  await prisma.dailyGoalSettings.updateMany({
    where: { id: current.id, userId: user.id, studyGuideId: guide.id },
    data: {
      timeZone: parsed.data.timeZone,
      firstStudyDeadline: parsed.data.enabledMetrics.includes("firstStudy") ? parsed.data.firstStudyDeadline || null : null,
      includeMockExams: parsed.data.includeMockExams,
      activeWeekdays: parsed.data.activeWeekdays,
      plannedRestWeekdays: parsed.data.plannedRestWeekdays,
      enabledMetrics: parsed.data.enabledMetrics,
      weekdayTargets: mainTargets as unknown as Prisma.InputJsonValue,
      saturdayTargets: weekendTargets("saturday") as unknown as Prisma.InputJsonValue,
      sundayTargets: weekendTargets("sunday") as unknown as Prisma.InputJsonValue,
    },
  });
  refreshGoals();
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
