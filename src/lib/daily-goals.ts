export const DAILY_GOAL_METRICS = ["minutes", "questions", "sessions", "reviews", "cyclePosition", "firstStudy"] as const;
export type DailyGoalMetric = (typeof DAILY_GOAL_METRICS)[number];
export type DayStatus = "REST" | "IN_PROGRESS" | "MINIMUM" | "TARGET" | "EXCELLENT" | "NO_ACTIVITY";

export type GoalTier = {
  minutes: number;
  questions: number;
  sessions: number;
  reviews: number;
  cyclePosition: number;
  firstStudy: number;
};

export type GoalTargets = { minimum: GoalTier; target: GoalTier; excellent: GoalTier };

export type DaySource = {
  minutes: number;
  questions: number;
  sessions: number;
  reviews: number;
  cyclePosition: number;
  firstStudyAt: Date | null;
  mockExamMinutes: number;
  mockExamQuestions: number;
  mockExams: number;
  manualMinimumDone: number;
  manualMinimumTotal: number;
  manualTargetDone: number;
  manualTargetTotal: number;
};

export type DaySummary = DaySource & {
  dayKey: string;
  weekday: number;
  plannedRest: boolean;
  status: DayStatus;
  percentage: number;
  minimumMet: boolean;
  targetMet: boolean;
  excellentMet: boolean;
  nextAction: string;
};

export function emptyDaySource(): DaySource {
  return { minutes: 0, questions: 0, sessions: 0, reviews: 0, cyclePosition: 0, firstStudyAt: null, mockExamMinutes: 0, mockExamQuestions: 0, mockExams: 0, manualMinimumDone: 0, manualMinimumTotal: 0, manualTargetDone: 0, manualTargetTotal: 0 };
}

export function applyStudySession(source: DaySource, session: { estimatedMinutes: number; correct: number; wrong: number; cyclePosition: number | null }) {
  source.minutes += session.estimatedMinutes;
  source.questions += session.correct + session.wrong;
  source.sessions += 1;
  if (session.cyclePosition !== null) source.cyclePosition += 1;
  return source;
}

export function applyMockExam(source: DaySource, exam: { durationMinutes: number; totalQuestions: number }) {
  source.mockExamMinutes += exam.durationMinutes;
  source.mockExamQuestions += exam.totalQuestions;
  source.mockExams += 1;
  return source;
}

export const EMPTY_TIER: GoalTier = { minutes: 0, questions: 0, sessions: 0, reviews: 0, cyclePosition: 0, firstStudy: 0 };

export const DATAPREV_TARGETS: GoalTargets = {
  minimum: { minutes: 60, questions: 20, sessions: 1, reviews: 0, cyclePosition: 0, firstStudy: 0 },
  target: { minutes: 120, questions: 40, sessions: 2, reviews: 1, cyclePosition: 1, firstStudy: 0 },
  excellent: { minutes: 150, questions: 60, sessions: 0, reviews: 1, cyclePosition: 0, firstStudy: 0 },
};

export const DEFAULT_TARGETS: GoalTargets = {
  minimum: { minutes: 30, questions: 10, sessions: 1, reviews: 0, cyclePosition: 0, firstStudy: 0 },
  target: { minutes: 60, questions: 20, sessions: 1, reviews: 1, cyclePosition: 1, firstStudy: 0 },
  excellent: { minutes: 90, questions: 30, sessions: 0, reviews: 1, cyclePosition: 0, firstStudy: 0 },
};

export function dayKeyInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function timeInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.hour}:${value.minute}`;
}

export function weekdayFromDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function shiftDayKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function parseTargets(value: unknown, fallback: GoalTargets): GoalTargets {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const tier = (name: keyof GoalTargets) => {
    const source = record[name] && typeof record[name] === "object" ? record[name] as Record<string, unknown> : {};
    return Object.fromEntries(Object.keys(EMPTY_TIER).map((key) => [key, Math.max(0, Number(source[key] ?? fallback[name][key as DailyGoalMetric]) || 0)])) as GoalTier;
  };
  return { minimum: tier("minimum"), target: tier("target"), excellent: tier("excellent") };
}

function reached(tier: GoalTier, enabled: DailyGoalMetric[], actual: GoalTier, firstStudyMet: boolean) {
  const applicable = enabled.filter((metric) => tier[metric] > 0);
  if (!applicable.length) return false;
  const flexible = applicable.filter((metric) => metric === "minutes" || metric === "questions" || metric === "sessions");
  const required = applicable.filter((metric) => !flexible.some((item) => item === metric));
  const flexibleMet = !flexible.length || flexible.some((metric) => actual[metric] >= tier[metric]);
  return flexibleMet && required.every((metric) => metric === "firstStudy" ? firstStudyMet : actual[metric] >= tier[metric]);
}

export function buildDaySummary(input: {
  dayKey: string;
  source: DaySource;
  targets: GoalTargets;
  enabledMetrics: DailyGoalMetric[];
  activeWeekdays: number[];
  plannedRestWeekdays: number[];
  firstStudyDeadline: string | null;
  timeZone: string;
  includeMockExams: boolean;
  isToday?: boolean;
}): DaySummary {
  const weekday = weekdayFromDayKey(input.dayKey);
  const plannedRest = !input.activeWeekdays.includes(weekday) || input.plannedRestWeekdays.includes(weekday);
  const actual: GoalTier = {
    minutes: input.source.minutes + (input.includeMockExams ? input.source.mockExamMinutes : 0),
    questions: input.source.questions + (input.includeMockExams ? input.source.mockExamQuestions : 0),
    sessions: input.source.sessions,
    reviews: input.source.reviews,
    cyclePosition: input.source.cyclePosition,
    firstStudy: input.source.firstStudyAt ? 1 : 0,
  };
  const firstStudyMet = Boolean(input.source.firstStudyAt && input.firstStudyDeadline && timeInTimeZone(input.source.firstStudyAt, input.timeZone) <= input.firstStudyDeadline);
  const automaticMinimum = reached(input.targets.minimum, input.enabledMetrics, actual, firstStudyMet);
  const automaticTarget = reached(input.targets.target, input.enabledMetrics, actual, firstStudyMet);
  const automaticExcellent = reached(input.targets.excellent, input.enabledMetrics, actual, firstStudyMet);
  const minimumMet = automaticMinimum && input.source.manualMinimumDone >= input.source.manualMinimumTotal;
  const targetMet = automaticTarget && minimumMet && input.source.manualTargetDone >= input.source.manualTargetTotal;
  const excellentMet = automaticExcellent && targetMet;
  const mainItems = input.enabledMetrics.filter((metric) => input.targets.target[metric] > 0);
  const flexibleItems = mainItems.filter((metric) => metric === "minutes" || metric === "questions" || metric === "sessions");
  const requiredItems = mainItems.filter((metric) => !flexibleItems.some((item) => item === metric));
  const ratio = (metric: DailyGoalMetric) => {
    if (metric === "firstStudy") return firstStudyMet ? 1 : 0;
    return Math.min(1, actual[metric] / input.targets.target[metric]);
  };
  const ratios = [...(flexibleItems.length ? [Math.max(...flexibleItems.map(ratio))] : []), ...requiredItems.map(ratio)];
  if (input.source.manualTargetTotal) ratios.push(Math.min(1, input.source.manualTargetDone / input.source.manualTargetTotal));
  const percentage = ratios.length ? Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length * 100) : 0;
  const hasActivity = actual.minutes > 0 || actual.questions > 0 || actual.sessions > 0 || actual.reviews > 0 || input.source.mockExams > 0 || input.source.manualMinimumDone + input.source.manualTargetDone > 0;
  const status: DayStatus = plannedRest ? "REST" : excellentMet ? "EXCELLENT" : targetMet ? "TARGET" : minimumMet ? "MINIMUM" : input.isToday ? "IN_PROGRESS" : hasActivity ? "IN_PROGRESS" : "NO_ACTIVITY";

  const flexibleMet = flexibleItems.some((metric) => actual[metric] >= input.targets.target[metric]);
  const missing = requiredItems.find((metric) => metric === "firstStudy" ? !firstStudyMet : actual[metric] < input.targets.target[metric]);
  const labels: Record<DailyGoalMetric, string> = {
    minutes: `Estude mais ${Math.max(0, input.targets.target.minutes - actual.minutes)} min para concluir sua meta.`,
    questions: `Resolva mais ${Math.max(0, input.targets.target.questions - actual.questions)} questões.`,
    sessions: "Faça mais uma sessão para concluir sua meta.",
    reviews: "Conclua uma revisão pendente.",
    cyclePosition: "Faça mais uma sessão do ciclo para concluir sua meta.",
    firstStudy: input.firstStudyDeadline ? `Inicie o primeiro estudo até ${input.firstStudyDeadline}.` : "Inicie seu primeiro estudo.",
  };
  const flexibleAction = flexibleItems.length && !flexibleMet ? flexibleItems.map((metric) => metric === "minutes" ? `${Math.max(0, input.targets.target.minutes - actual.minutes)} min` : metric === "questions" ? `${Math.max(0, input.targets.target.questions - actual.questions)} questões` : `${Math.max(0, input.targets.target.sessions - actual.sessions)} sessão(ões)`).join(" ou ") : null;
  const nextAction = plannedRest ? "Descanso planejado. O ciclo continua no próximo dia ativo." : excellentMet ? "Dia excelente. Pode encerrar sem culpa." : targetMet ? "Meta diária concluída." : flexibleAction ? `Complete ${flexibleAction}.` : missing ? labels[missing] : input.source.manualTargetDone < input.source.manualTargetTotal ? "Conclua sua meta manual de hoje." : "Você avançou. Amanhã o ciclo continua.";
  return { ...input.source, dayKey: input.dayKey, weekday, plannedRest, status, percentage, minimumMet, targetMet, excellentMet, nextAction };
}

export function calculateStreak(daysAscending: DaySummary[], todayKey: string) {
  const eligible = daysAscending.filter((day) => day.dayKey <= todayKey);
  let current = 0;
  let best = 0;
  let run = 0;
  for (const day of eligible) {
    if (day.plannedRest) continue;
    if (day.minimumMet) run += 1;
    else run = 0;
    best = Math.max(best, run);
  }
  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const day = eligible[index];
    if (day.plannedRest) continue;
    if (day.dayKey === todayKey && !day.minimumMet) continue;
    if (!day.minimumMet) break;
    current += 1;
  }
  return { current, best };
}

export function calculateRhythm(daysAscending: DaySummary[], todayKey: string) {
  const past28 = daysAscending.filter((day) => day.dayKey <= todayKey).slice(-28);
  const recent = past28.slice(-7);
  const baseline = past28.slice(0, -7);
  const average = (items: DaySummary[], field: "minutes" | "questions" | "sessions") => items.length ? items.reduce((sum, day) => sum + day[field], 0) / items.length : 0;
  const recentMinutes = average(recent, "minutes");
  const baselineMinutes = average(baseline, "minutes");
  const variation = baselineMinutes > 0 ? (recentMinutes - baselineMinutes) / baselineMinutes : recentMinutes > 0 ? 1 : 0;
  const direction = variation > 0.1 ? "increasing" : variation < -0.1 ? "decreasing" : "stable";
  const goalsMet = recent.filter((day) => day.targetMet).length;
  const reason = baselineMinutes > 0
    ? `Seu tempo médio ${variation >= 0 ? "subiu" : "caiu"} de ${Math.round(baselineMinutes)} para ${Math.round(recentMinutes)} minutos nos últimos 7 dias.`
    : `Você cumpriu a meta em ${goalsMet} dos últimos ${recent.length} dias.`;
  return {
    direction,
    reason,
    recent: { minutes: recentMinutes, questions: average(recent, "questions"), sessions: average(recent, "sessions"), activeDays: recent.filter((day) => day.minutes > 0 || day.questions > 0).length, goalsMet },
    baseline: { minutes: baselineMinutes, questions: average(baseline, "questions"), sessions: average(baseline, "sessions"), activeDays: baseline.filter((day) => day.minutes > 0 || day.questions > 0).length, goalsMet: baseline.filter((day) => day.targetMet).length },
  };
}
