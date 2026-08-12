import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DATAPREV_TARGETS,
  applyMockExam,
  applyStudySession,
  buildDaySummary,
  calculateRhythm,
  calculateStreak,
  dayKeyInTimeZone,
  emptyDaySource,
  shiftDayKey,
  type GoalTargets,
} from "../src/lib/daily-goals";

const enabled = ["minutes", "questions", "sessions", "reviews", "cyclePosition"] as const;
function summary(dayKey: string, source = emptyDaySource(), targets = DATAPREV_TARGETS, extra: Partial<Parameters<typeof buildDaySummary>[0]> = {}) {
  return buildDaySummary({ dayKey, source, targets, enabledMetrics: [...enabled], activeWeekdays: [1, 2, 3, 4, 5, 6, 7], plannedRestWeekdays: [], firstStudyDeadline: null, timeZone: "America/Sao_Paulo", includeMockExams: false, ...extra });
}

test("agrega minutos, questões e sessões usando acertos + erros", () => {
  const source = emptyDaySource();
  applyStudySession(source, { estimatedMinutes: 72, correct: 18, wrong: 10, cyclePosition: null });
  assert.deepEqual({ minutes: source.minutes, questions: source.questions, sessions: source.sessions }, { minutes: 72, questions: 28, sessions: 1 });
});

test("estudo avulso conta métricas, mas somente sessão de ciclo conclui posição", () => {
  const source = emptyDaySource();
  applyStudySession(source, { estimatedMinutes: 30, correct: 8, wrong: 2, cyclePosition: null });
  assert.equal(source.cyclePosition, 0);
  applyStudySession(source, { estimatedMinutes: 30, correct: 7, wrong: 3, cyclePosition: 4 });
  assert.equal(source.cyclePosition, 1);
  assert.equal(source.sessions, 2);
});

test("aula sem questões soma tempo, conta sessão e conclui a posição do ciclo", () => {
  const source = emptyDaySource();
  applyStudySession(source, { estimatedMinutes: 45, correct: 0, wrong: 0, cyclePosition: 3 });
  assert.deepEqual({ minutes: source.minutes, questions: source.questions, sessions: source.sessions, cyclePosition: source.cyclePosition }, { minutes: 45, questions: 0, sessions: 1, cyclePosition: 1 });
});

test("meta principal aceita tempo, questões ou sessões como caminhos alternativos", () => {
  const source = emptyDaySource();
  Object.assign(source, { minutes: 120, questions: 0, sessions: 1, reviews: 1, cyclePosition: 1 });
  assert.equal(summary("2026-08-03", source).targetMet, true);
});

test("classifica mínimo, meta principal e dia excelente sem punir progresso parcial", () => {
  const minimum = emptyDaySource(); Object.assign(minimum, { minutes: 60, questions: 20, sessions: 1 });
  assert.equal(summary("2026-08-03", minimum).status, "MINIMUM");
  const target = emptyDaySource(); Object.assign(target, { minutes: 120, questions: 40, sessions: 2, reviews: 1, cyclePosition: 1 });
  assert.equal(summary("2026-08-03", target).status, "TARGET");
  const excellent = emptyDaySource(); Object.assign(excellent, { minutes: 150, questions: 60, sessions: 2, reviews: 1, cyclePosition: 1 });
  assert.equal(summary("2026-08-03", excellent).status, "EXCELLENT");
  assert.equal(summary("2026-08-03", emptyDaySource()).status, "NO_ACTIVITY");
});

test("revisões entram pela conclusão real", () => {
  const source = emptyDaySource(); Object.assign(source, { minutes: 120, questions: 40, sessions: 2, cyclePosition: 1 });
  assert.equal(summary("2026-08-03", source).targetMet, false);
  source.reviews += 1;
  assert.equal(summary("2026-08-03", source).targetMet, true);
});

test("simulado permanece separado e só entra com opt-in", () => {
  const source = emptyDaySource();
  applyMockExam(source, { durationMinutes: 120, totalQuestions: 40 });
  const excluded = summary("2026-08-03", source);
  const included = summary("2026-08-03", source, DATAPREV_TARGETS, { includeMockExams: true });
  assert.equal(excluded.percentage, 0);
  assert.ok(included.percentage > excluded.percentage);
  assert.deepEqual({ exams: source.mockExams, minutes: source.mockExamMinutes, questions: source.mockExamQuestions }, { exams: 1, minutes: 120, questions: 40 });
});

test("descanso planejado não quebra sequência e hoje incompleto ainda está em andamento", () => {
  const met = emptyDaySource(); Object.assign(met, { minutes: 60, questions: 20, sessions: 1 });
  const days = [summary("2026-08-01", structuredClone(met)), summary("2026-08-02", emptyDaySource(), DATAPREV_TARGETS, { plannedRestWeekdays: [7] }), summary("2026-08-03", structuredClone(met)), summary("2026-08-04", emptyDaySource(), DATAPREV_TARGETS, { isToday: true })];
  assert.equal(days[1].status, "REST");
  assert.deepEqual(calculateStreak(days, "2026-08-04"), { current: 2, best: 2 });
  assert.equal(days[3].status, "IN_PROGRESS");
});

test("virada do dia respeita o fuso horário configurado", () => {
  const instant = new Date("2026-08-04T02:30:00.000Z");
  assert.equal(dayKeyInTimeZone(instant, "America/Sao_Paulo"), "2026-08-03");
  assert.equal(dayKeyInTimeZone(instant, "UTC"), "2026-08-04");
});

test("meta de primeiro estudo usa o início real e o horário local", () => {
  const targets: GoalTargets = { minimum: { ...DATAPREV_TARGETS.minimum, firstStudy: 1 }, target: { ...DATAPREV_TARGETS.target, firstStudy: 1 }, excellent: DATAPREV_TARGETS.excellent };
  const source = emptyDaySource(); Object.assign(source, { minutes: 120, questions: 40, sessions: 2, reviews: 1, cyclePosition: 1, firstStudyAt: new Date("2026-08-03T10:30:00Z") });
  assert.equal(summary("2026-08-03", source, targets, { enabledMetrics: [...enabled, "firstStudy"], firstStudyDeadline: "08:00" }).targetMet, true);
  source.firstStudyAt = new Date("2026-08-03T12:00:00Z");
  assert.equal(summary("2026-08-03", source, targets, { enabledMetrics: [...enabled, "firstStudy"], firstStudyDeadline: "08:00" }).targetMet, false);
});

test("sábado e domingo aceitam metas diferentes", () => {
  const saturday: GoalTargets = { minimum: { ...DATAPREV_TARGETS.minimum, minutes: 30 }, target: { ...DATAPREV_TARGETS.target, minutes: 60 }, excellent: DATAPREV_TARGETS.excellent };
  const sunday: GoalTargets = { minimum: { ...DATAPREV_TARGETS.minimum, minutes: 15 }, target: { ...DATAPREV_TARGETS.target, minutes: 30 }, excellent: DATAPREV_TARGETS.excellent };
  const source = emptyDaySource(); Object.assign(source, { minutes: 30, questions: 0, sessions: 0, reviews: 1, cyclePosition: 1 });
  assert.equal(summary("2026-08-01", structuredClone(source), saturday).targetMet, false);
  assert.equal(summary("2026-08-02", structuredClone(source), sunday).targetMet, true);
});

test("Ritmo compara 7 dias com os 21 anteriores e explica a variação", () => {
  const days = Array.from({ length: 28 }, (_, index) => { const source = emptyDaySource(); Object.assign(source, { minutes: index >= 21 ? 120 : 60, questions: 20, sessions: 1 }); return summary(shiftDayKey("2026-07-07", index), source); });
  const rhythm = calculateRhythm(days, days.at(-1)!.dayKey);
  assert.equal(rhythm.direction, "increasing");
  assert.match(rhythm.reason, /60 para 120 minutos/);
});

test("consultas isolam usuário e guia, atualização é revalidada e formulário evita envio duplicado", () => {
  const service = readFileSync(resolve(process.cwd(), "src/lib/daily-goals-service.ts"), "utf8");
  const activePanel = readFileSync(resolve(process.cwd(), "src/components/study/active-study-panel.tsx"), "utf8");
  const forms = readFileSync(resolve(process.cwd(), "src/components/goal-forms.tsx"), "utf8");
  assert.match(service, /where: \{ userId, studyGuideId/);
  assert.match(activePanel, /sessionId[\s\S]*router\.refresh\(\)/);
  assert.match(forms, /useFormStatus/);
  assert.match(forms, /disabled=\{pending\}/);
});

test("falha de rede é tratada sem marcar revisão e migration é aditiva", () => {
  const review = readFileSync(resolve(process.cwd(), "src/components/review-actions.tsx"), "utf8");
  const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260804120000_daily_goals/migration.sql"), "utf8");
  assert.match(review, /catch[\s\S]*Falha de rede/);
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|COLUMN|TYPE)|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN/i);
  assert.match(migration, /CREATE TABLE "DailyGoalSettings"/);
});

test("configuração simplificada expõe apenas metas compreensíveis ao usuário", () => {
  const forms = readFileSync(resolve(process.cwd(), "src/components/goal-forms.tsx"), "utf8");
  const actions = readFileSync(resolve(process.cwd(), "src/app/goals-actions.ts"), "utf8");
  const service = readFileSync(resolve(process.cwd(), "src/lib/daily-goals-service.ts"), "utf8");
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/metas/page.tsx"), "utf8");

  assert.match(forms, /name="dailyMinutes"/);
  assert.match(forms, /name="weeklyQuestions"/);
  assert.match(forms, /name="examDate"/);
  assert.match(forms, /name="activeWeekdays"/);
  assert.doesNotMatch(forms, /name="enabledMetrics"|name="plannedRestWeekdays"|name="firstStudyDeadline"/);
  assert.match(actions, /enabledMetrics: \["minutes"\]/);
  assert.match(service, /enabledMetrics: \["minutes"\]/);
  assert.doesNotMatch(page, /<ManualGoals/);
});
