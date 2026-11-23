import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DATAPREV_TARGETS,
  DEFAULT_TARGETS,
  type DaySource,
  buildDaySummary,
  applyMockExam,
  applyStudySession,
  calculateRhythm,
  calculateStreak,
  dayKeyInTimeZone,
  parseTargets,
  emptyDaySource,
  shiftDayKey,
  weekdayFromDayKey,
  targetsForWeekday,
  weeklyStudyTime,
} from "@/lib/daily-goals";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";

export async function ensureDailyGoalSettings(userId: string, studyGuideId: string) {
  const existing = await prisma.dailyGoalSettings.findFirst({ where: { userId, studyGuideId } });
  if (existing) return existing;
  const guide = await prisma.studyGuide.findFirst({ where: { id: studyGuideId, userId }, select: { name: true } });
  if (!guide) throw new Error("Guia de estudos não encontrado.");
  const targets = guide?.name.toUpperCase().includes("DATAPREV") ? DATAPREV_TARGETS : DEFAULT_TARGETS;
  return prisma.dailyGoalSettings.upsert({ where: { studyGuideId }, create: { userId, studyGuideId, weekdayTargets: targets as unknown as Prisma.InputJsonValue }, update: {} });
}

export async function getDailyGoalsData(userId: string, studyGuideId: string, now = new Date()) {
  const settings = await ensureDailyGoalSettings(userId, studyGuideId);
  const todayKey = dayKeyInTimeZone(now, settings.timeZone);
  const [sessions, reviews, activeSessions, mockExams, manualGoals, checks, reflection, guideSettings, reviewsDue] = await Promise.all([
    prisma.studySession.findMany({ where: { userId, studyGuideId }, select: { date: true, estimatedMinutes: true, correct: true, wrong: true, cyclePosition: true } }),
    prisma.reviewSchedule.findMany({ where: { userId, studyGuideId, status: "COMPLETED" }, select: { subjectId: true, completedAt: true } }),
    prisma.activeStudySession.findMany({ where: { userId, studyGuideId, status: { not: "CANCELLED" } }, select: { startedAt: true } }),
    prisma.mockExam.findMany({ where: { userId, studyGuideId }, select: { takenAt: true, durationMinutes: true, totalQuestions: true } }),
    prisma.manualDailyGoal.findMany({ where: { userId, studyGuideId, active: true }, orderBy: { createdAt: "asc" } }),
    prisma.manualDailyGoalCheck.findMany({ where: { userId, studyGuideId, dayKey: { lte: todayKey } } }),
    prisma.dailyReflection.findFirst({ where: { userId, studyGuideId, dayKey: todayKey } }),
    getStudyGuideSettings(userId, studyGuideId),
    prisma.reviewSchedule.findMany({ where: { userId, studyGuideId, status: "PENDING", dueAt: { lte: now } }, distinct: ["subjectId"], select: { subjectId: true } }),
  ]);
  const sources = new Map<string, DaySource>();
  const sourceFor = (key: string) => {
    const existing = sources.get(key);
    if (existing) return existing;
    const source = emptyDaySource();
    sources.set(key, source);
    return source;
  };
  for (const session of sessions) {
    const source = sourceFor(dayKeyInTimeZone(session.date, settings.timeZone));
    applyStudySession(source, session);
  }
  const completedReviewKeys = new Set<string>();
  for (const review of reviews) {
    if (!review.completedAt) continue;
    const dayKey = dayKeyInTimeZone(review.completedAt, settings.timeZone);
    const key = `${dayKey}:${review.subjectId}`;
    if (completedReviewKeys.has(key)) continue;
    completedReviewKeys.add(key);
    sourceFor(dayKey).reviews += 1;
  }
  for (const active of activeSessions) {
    const source = sourceFor(dayKeyInTimeZone(active.startedAt, settings.timeZone));
    if (!source.firstStudyAt || active.startedAt < source.firstStudyAt) source.firstStudyAt = active.startedAt;
  }
  for (const exam of mockExams) {
    const source = sourceFor(dayKeyInTimeZone(exam.takenAt, settings.timeZone));
    applyMockExam(source, exam);
  }
  const checkSet = new Set(checks.map((check) => `${check.manualGoalId}:${check.dayKey}`));
  const earliestEventKey = [...sources.keys()].sort()[0];
  const firstKey = earliestEventKey && earliestEventKey < shiftDayKey(todayKey, -34) ? earliestEventKey : shiftDayKey(todayKey, -34);
  const dayKeys: string[] = [];
  for (let dayKey = firstKey; dayKey <= todayKey; dayKey = shiftDayKey(dayKey, 1)) dayKeys.push(dayKey);
  const days = dayKeys.map((dayKey) => {
    const weekday = weekdayFromDayKey(dayKey);
    const source = sourceFor(dayKey);
    return buildDaySummary({
      dayKey,
      source,
      targets: targetsForWeekday(settings, weekday),
      enabledMetrics: ["minutes"],
      activeWeekdays: settings.activeWeekdays,
      plannedRestWeekdays: [],
      firstStudyDeadline: null,
      timeZone: settings.timeZone,
      includeMockExams: false,
      isToday: dayKey === todayKey,
    });
  });
  const today = days.at(-1)!;
  const studyTime = weeklyStudyTime(todayKey, settings, new Map(days.slice(-35).map(day => [day.dayKey, day.minutes])));
  const streak = calculateStreak(days, todayKey);
  const rhythm = calculateRhythm(days, todayKey);
  const weekdayTargets = parseTargets(settings.weekdayTargets, DEFAULT_TARGETS);
  const todayTargets = targetsForWeekday(settings, today.weekday);
  const weekStartKey = studyTime.days[0].date;
  const calendarWeek = days.filter((day) => day.dayKey >= weekStartKey && day.dayKey <= todayKey);
  const questionsThisWeek = calendarWeek.reduce((sum, day) => sum + day.questions, 0);
  const questionsRemaining = Math.max(0, guideSettings.weeklyQuestionsGoal - questionsThisWeek);
  const activeDaysRemaining = settings.activeWeekdays.filter((weekday) => weekday >= today.weekday).length || 1;
  const plan = {
    dailyMinutes: todayTargets.target.minutes,
    weeklyQuestions: guideSettings.weeklyQuestionsGoal,
    questionsThisWeek,
    questionsRemaining,
    suggestedQuestionsToday: questionsRemaining ? Math.ceil(questionsRemaining / activeDaysRemaining) : 0,
    reviewsDue: reviewsDue.length,
    examDate: guideSettings.examDate,
  };
  return { settings, targets: todayTargets, weekdayTargets, saturdayTargets: parseTargets(settings.saturdayTargets, weekdayTargets), sundayTargets: parseTargets(settings.sundayTargets, weekdayTargets), today, studyTime, days: days.slice(-28), streak, rhythm, plan, manualGoals: manualGoals.map((goal) => ({ ...goal, checkedToday: checkSet.has(`${goal.id}:${todayKey}`) })), reflection };
}

export type DailyGoalsData = Awaited<ReturnType<typeof getDailyGoalsData>>;
