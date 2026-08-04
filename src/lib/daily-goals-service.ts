import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DATAPREV_TARGETS,
  DEFAULT_TARGETS,
  DAILY_GOAL_METRICS,
  type DailyGoalMetric,
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
} from "@/lib/daily-goals";

export async function ensureDailyGoalSettings(userId: string, studyGuideId: string) {
  const existing = await prisma.dailyGoalSettings.findFirst({ where: { userId, studyGuideId } });
  if (existing) return existing;
  const guide = await prisma.studyGuide.findFirst({ where: { id: studyGuideId, userId }, select: { name: true } });
  if (!guide) throw new Error("Guia de estudos não encontrado.");
  const targets = guide?.name.toUpperCase().includes("DATAPREV") ? DATAPREV_TARGETS : DEFAULT_TARGETS;
  return prisma.dailyGoalSettings.upsert({ where: { studyGuideId }, create: { userId, studyGuideId, weekdayTargets: targets as unknown as Prisma.InputJsonValue }, update: {} });
}

function targetsForWeekday(settings: Awaited<ReturnType<typeof ensureDailyGoalSettings>>, weekday: number) {
  const fallback = parseTargets(settings.weekdayTargets, DEFAULT_TARGETS);
  if (weekday === 6 && settings.saturdayTargets) return parseTargets(settings.saturdayTargets, fallback);
  if (weekday === 7 && settings.sundayTargets) return parseTargets(settings.sundayTargets, fallback);
  return fallback;
}

export async function getDailyGoalsData(userId: string, studyGuideId: string, now = new Date()) {
  const settings = await ensureDailyGoalSettings(userId, studyGuideId);
  const todayKey = dayKeyInTimeZone(now, settings.timeZone);
  const [sessions, reviews, activeSessions, mockExams, manualGoals, checks, reflection] = await Promise.all([
    prisma.studySession.findMany({ where: { userId, studyGuideId }, select: { date: true, estimatedMinutes: true, correct: true, wrong: true, cyclePosition: true } }),
    prisma.reviewSchedule.findMany({ where: { userId, studyGuideId, status: "COMPLETED" }, select: { completedAt: true } }),
    prisma.activeStudySession.findMany({ where: { userId, studyGuideId, status: { not: "CANCELLED" } }, select: { startedAt: true } }),
    prisma.mockExam.findMany({ where: { userId, studyGuideId }, select: { takenAt: true, durationMinutes: true, totalQuestions: true } }),
    prisma.manualDailyGoal.findMany({ where: { userId, studyGuideId, active: true }, orderBy: { createdAt: "asc" } }),
    prisma.manualDailyGoalCheck.findMany({ where: { userId, studyGuideId, dayKey: { lte: todayKey } } }),
    prisma.dailyReflection.findFirst({ where: { userId, studyGuideId, dayKey: todayKey } }),
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
  for (const review of reviews) if (review.completedAt) sourceFor(dayKeyInTimeZone(review.completedAt, settings.timeZone)).reviews += 1;
  for (const active of activeSessions) {
    const source = sourceFor(dayKeyInTimeZone(active.startedAt, settings.timeZone));
    if (!source.firstStudyAt || active.startedAt < source.firstStudyAt) source.firstStudyAt = active.startedAt;
  }
  for (const exam of mockExams) {
    const source = sourceFor(dayKeyInTimeZone(exam.takenAt, settings.timeZone));
    applyMockExam(source, exam);
  }
  const checkSet = new Set(checks.map((check) => `${check.manualGoalId}:${check.dayKey}`));
  const earliestEventKey = [...sources.keys(), ...manualGoals.map((goal) => dayKeyInTimeZone(goal.createdAt, settings.timeZone))].sort()[0];
  const firstKey = earliestEventKey && earliestEventKey < shiftDayKey(todayKey, -34) ? earliestEventKey : shiftDayKey(todayKey, -34);
  const dayKeys: string[] = [];
  for (let dayKey = firstKey; dayKey <= todayKey; dayKey = shiftDayKey(dayKey, 1)) dayKeys.push(dayKey);
  const days = dayKeys.map((dayKey) => {
    const weekday = weekdayFromDayKey(dayKey);
    const source = sourceFor(dayKey);
    for (const goal of manualGoals.filter((item) => dayKeyInTimeZone(item.createdAt, settings.timeZone) <= dayKey && item.activeWeekdays.includes(weekday))) {
      const checked = checkSet.has(`${goal.id}:${dayKey}`);
      if (goal.tier === "MINIMUM") { source.manualMinimumTotal += 1; if (checked) source.manualMinimumDone += 1; }
      else { source.manualTargetTotal += 1; if (checked) source.manualTargetDone += 1; }
    }
    return buildDaySummary({ dayKey, source, targets: targetsForWeekday(settings, weekday), enabledMetrics: settings.enabledMetrics.filter((metric): metric is DailyGoalMetric => DAILY_GOAL_METRICS.includes(metric as DailyGoalMetric)), activeWeekdays: settings.activeWeekdays, plannedRestWeekdays: settings.plannedRestWeekdays, firstStudyDeadline: settings.firstStudyDeadline, timeZone: settings.timeZone, includeMockExams: settings.includeMockExams, isToday: dayKey === todayKey });
  });
  const today = days.at(-1)!;
  const week = days.slice(-7);
  const streak = calculateStreak(days, todayKey);
  const rhythm = calculateRhythm(days, todayKey);
  const weekTotals = { minimumDays: week.filter((day) => day.minimumMet).length, targetDays: week.filter((day) => day.targetMet).length, minutes: week.reduce((sum, day) => sum + day.minutes, 0), questions: week.reduce((sum, day) => sum + day.questions, 0), sessions: week.reduce((sum, day) => sum + day.sessions, 0), averageMinutes: Math.round(week.reduce((sum, day) => sum + day.minutes, 0) / 7) };
  const weekdayTargets = parseTargets(settings.weekdayTargets, DEFAULT_TARGETS);
  return { settings, targets: targetsForWeekday(settings, today.weekday), weekdayTargets, saturdayTargets: parseTargets(settings.saturdayTargets, weekdayTargets), sundayTargets: parseTargets(settings.sundayTargets, weekdayTargets), today, week, days: days.slice(-28), streak, rhythm, weekTotals, manualGoals: manualGoals.map((goal) => ({ ...goal, checkedToday: checkSet.has(`${goal.id}:${todayKey}`) })), reflection };
}

export type DailyGoalsData = Awaited<ReturnType<typeof getDailyGoalsData>>;
