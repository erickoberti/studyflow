import { format, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";

export type PriorityLevel = "urgente" | "atencao" | "bom" | "forte";
export type MetaSignal = "verde" | "amarelo" | "vermelho";

function classify(percentage: number): PriorityLevel {
  if (percentage < 60) return "urgente";
  if (percentage < 70) return "atencao";
  if (percentage < 80) return "bom";
  return "forte";
}

function metaSignal(percentage: number, target: number) {
  const gap = target - percentage;
  if (gap <= 0) return { gap, level: "verde" as MetaSignal, label: "Manter" };
  if (gap <= 10) return { gap, level: "amarelo" as MetaSignal, label: "Ajustar" };
  return { gap, level: "vermelho" as MetaSignal, label: "Urgente" };
}

export async function getNextCycleSuggestion(userId: string) {
  const activeEntries = await prisma.cycleEntry.findMany({
    where: { userId, active: true, subject: { active: true, discipline: { active: true } } },
    include: { subject: { include: { discipline: true } } },
    orderBy: { orderIndex: "asc" },
  });

  if (!activeEntries.length) {
    return { last: null, next: null };
  }

  const lastSession = await prisma.studySession.findFirst({
    where: { userId },
    include: { cycleEntry: { include: { subject: { include: { discipline: true } } } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  if (!lastSession) {
    return { last: null, next: activeEntries[0] };
  }

  const currentOrder = lastSession.cycleEntry.orderIndex;
  const next = activeEntries.find((entry) => entry.orderIndex > currentOrder) ?? activeEntries[0];

  return { last: lastSession.cycleEntry, next };
}

export async function getDashboardData(userId: string) {
  const [sessions, settings] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId },
      include: {
        cycleEntry: {
          include: {
            subject: {
              include: {
                discipline: true,
              },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  const targetPercentage = settings?.targetPercentage ?? 80;

  const totalQuestions = sessions.reduce((sum, item) => sum + item.questions, 0);
  const totalCorrect = sessions.reduce((sum, item) => sum + item.correct, 0);
  const totalWrong = sessions.reduce((sum, item) => sum + item.wrong, 0);
  const totalEstimatedMinutes = sessions.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const overallPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  const byDay = new Map<string, { date: string; questions: number; percentage: number; correct: number }>();
  const byWeek = new Map<string, { week: string; questions: number; percentage: number; correct: number }>();
  const byDiscipline = new Map<string, { discipline: string; questions: number; correct: number; wrong: number }>();
  const bySubject = new Map<string, { subject: string; discipline: string; questions: number; correct: number; weight: number }>();

  for (const session of sessions) {
    const dayKey = format(session.date, "yyyy-MM-dd");
    const weekDate = startOfWeek(session.date, { weekStartsOn: 1 });
    const weekKey = format(weekDate, "yyyy-MM-dd");
    const disciplineName = session.cycleEntry.subject.discipline.name;
    const subjectName = session.cycleEntry.subject.name;

    const dayData = byDay.get(dayKey) ?? { date: dayKey, questions: 0, correct: 0, percentage: 0 };
    dayData.questions += session.questions;
    dayData.correct += session.correct;
    dayData.percentage = dayData.questions > 0 ? (dayData.correct / dayData.questions) * 100 : 0;
    byDay.set(dayKey, dayData);

    const weekData = byWeek.get(weekKey) ?? { week: weekKey, questions: 0, correct: 0, percentage: 0 };
    weekData.questions += session.questions;
    weekData.correct += session.correct;
    weekData.percentage = weekData.questions > 0 ? (weekData.correct / weekData.questions) * 100 : 0;
    byWeek.set(weekKey, weekData);

    const discData = byDiscipline.get(disciplineName) ?? { discipline: disciplineName, questions: 0, correct: 0, wrong: 0 };
    discData.questions += session.questions;
    discData.correct += session.correct;
    discData.wrong += session.wrong;
    byDiscipline.set(disciplineName, discData);

    const subjData = bySubject.get(subjectName) ?? {
      subject: subjectName,
      discipline: disciplineName,
      questions: 0,
      correct: 0,
      weight: session.cycleEntry.subject.weight,
    };
    subjData.questions += session.questions;
    subjData.correct += session.correct;
    bySubject.set(subjectName, subjData);
  }

  const disciplineStats = Array.from(byDiscipline.values()).map((row) => {
    const percentage = row.questions > 0 ? (row.correct / row.questions) * 100 : 0;
    const signal = metaSignal(percentage, targetPercentage);
    return {
      ...row,
      percentage,
      priority: classify(percentage),
      targetPercentage,
      gap: signal.gap,
      metaLevel: signal.level,
      metaLabel: signal.label,
    };
  });

  const subjectStats = Array.from(bySubject.values()).map((row) => {
    const percentage = row.questions > 0 ? (row.correct / row.questions) * 100 : 0;
    const score = percentage - row.weight * 4;
    const signal = metaSignal(percentage, targetPercentage);
    return {
      ...row,
      percentage,
      priority: classify(percentage),
      priorityScore: score,
      targetPercentage,
      gap: signal.gap,
      metaLevel: signal.level,
      metaLabel: signal.label,
    };
  });

  subjectStats.sort((a, b) => a.priorityScore - b.priorityScore);
  const overallSignal = metaSignal(overallPercentage, targetPercentage);

  return {
    totals: {
      totalQuestions,
      totalCorrect,
      totalWrong,
      totalEstimatedMinutes,
      overallPercentage,
      targetPercentage,
      gapToTarget: overallSignal.gap,
      metaLevel: overallSignal.level,
      metaLabel: overallSignal.label,
    },
    byDay: Array.from(byDay.values()),
    byWeek: Array.from(byWeek.values()),
    disciplineStats,
    subjectStats,
    strongestSubjects: [...subjectStats].sort((a, b) => b.percentage - a.percentage).slice(0, 5),
    weakestSubjects: [...subjectStats].sort((a, b) => a.percentage - b.percentage).slice(0, 5),
  };
}

export async function getReviewSuggestions(userId: string) {
  const subjects = await prisma.subject.findMany({
    where: { userId, active: true },
    include: {
      discipline: true,
      cycleEntries: {
        include: {
          sessions: {
            orderBy: { date: "desc" },
            take: 20,
          },
        },
      },
    },
  });

  const result = subjects.map((subject) => {
    const allSessions = subject.cycleEntries.flatMap((entry) => entry.sessions);
    const questions = allSessions.reduce((sum, item) => sum + item.questions, 0);
    const correct = allSessions.reduce((sum, item) => sum + item.correct, 0);
    const errors = allSessions.reduce((sum, item) => sum + item.wrong, 0);
    const percentage = questions > 0 ? (correct / questions) * 100 : 0;
    const lastStudy = allSessions[0]?.date ?? null;

    return {
      id: subject.id,
      subject: subject.name,
      discipline: subject.discipline.name,
      weight: subject.weight,
      questions,
      errors,
      percentage,
      lastStudy,
      priority: classify(percentage),
      noRecentStudy: !lastStudy || Date.now() - lastStudy.getTime() > 1000 * 60 * 60 * 24 * 7,
    };
  });

  return {
    stale: result
      .filter((item) => item.noRecentStudy)
      .sort((a, b) => (a.lastStudy?.getTime() ?? 0) - (b.lastStudy?.getTime() ?? 0))
      .slice(0, 8),
    weak: result.sort((a, b) => a.percentage - b.percentage).slice(0, 8),
    recent: result
      .filter((item) => item.lastStudy)
      .sort((a, b) => (b.lastStudy?.getTime() ?? 0) - (a.lastStudy?.getTime() ?? 0))
      .slice(0, 8),
  };
}