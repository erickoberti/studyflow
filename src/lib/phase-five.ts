export type WeightedDiscipline = { id: string; name: string; weight: number };

export function distributeQuestionsByWeight(totalQuestions: number, disciplines: WeightedDiscipline[]) {
  const eligible = disciplines.filter((item) => item.weight > 0);
  if (!Number.isInteger(totalQuestions) || totalQuestions <= 0 || eligible.length === 0) return [];
  const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
  const raw = eligible.map((item) => ({ ...item, exact: totalQuestions * item.weight / totalWeight }));
  const result = raw.map((item) => ({ ...item, questions: Math.floor(item.exact) }));
  let remaining = totalQuestions - result.reduce((sum, item) => sum + item.questions, 0);
  result.sort((a, b) => (b.exact - b.questions) - (a.exact - a.questions) || a.name.localeCompare(b.name));
  for (let index = 0; remaining > 0; index = (index + 1) % result.length) {
    result[index].questions += 1;
    remaining -= 1;
  }
  return result.sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({
    id: item.id,
    name: item.name,
    weight: item.weight,
    questions: item.questions,
    percentage: item.questions / totalQuestions * 100,
  }));
}

export function summarizeMockExam(results: Array<{ questions: number; correct: number }>) {
  const totalQuestions = results.reduce((sum, item) => sum + item.questions, 0);
  const correct = results.reduce((sum, item) => sum + item.correct, 0);
  if (results.some((item) => !Number.isInteger(item.questions) || !Number.isInteger(item.correct) || item.questions < 0 || item.correct < 0 || item.correct > item.questions)) {
    throw new Error("Resultados do simulado são inválidos.");
  }
  if (totalQuestions <= 0) throw new Error("O simulado deve possuir ao menos uma questão.");
  return { totalQuestions, correct, wrong: totalQuestions - correct, percentage: correct / totalQuestions * 100 };
}

export type ExamPlanInput = {
  now: Date;
  examDate: Date | null;
  totalSubjects: number;
  completedSubjects: number;
  inProgressSubjects: number;
  weeklyQuestionsGoal: number;
  sessionMinutes: number;
  questionsPerSession: number;
};

export function buildExamPlan(input: ExamPlanInput) {
  const remainingSubjects = Math.max(0, input.totalSubjects - input.completedSubjects);
  const milliseconds = input.examDate ? input.examDate.getTime() - input.now.getTime() : 0;
  const daysRemaining = input.examDate ? Math.max(0, Math.ceil(milliseconds / 86_400_000)) : null;
  const weeksRemaining = daysRemaining === null ? null : Math.max(1, Math.ceil(daysRemaining / 7));
  const questionsUntilExam = weeksRemaining === null ? null : weeksRemaining * Math.max(0, input.weeklyQuestionsGoal);
  const sessionsPerWeek = Math.max(1, Math.ceil(Math.max(0, input.weeklyQuestionsGoal) / Math.max(1, input.questionsPerSession)));
  const minutesPerWeek = sessionsPerWeek * Math.max(1, input.sessionMinutes);
  const subjectsPerWeek = weeksRemaining === null ? null : remainingSubjects / weeksRemaining;
  const coveragePercentage = input.totalSubjects ? input.completedSubjects / input.totalSubjects * 100 : 0;
  const onTrack = daysRemaining === null ? null : remainingSubjects === 0 || daysRemaining >= remainingSubjects;
  return { ...input, remainingSubjects, daysRemaining, weeksRemaining, questionsUntilExam, sessionsPerWeek, minutesPerWeek, subjectsPerWeek, coveragePercentage, onTrack };
}

export type RecommendationInput = {
  subjectId: string;
  subject: string;
  discipline: string;
  weight: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  percentage: number;
  passages: number;
  lastStudiedAt: Date | null;
};

export function buildExplainableRecommendations(subjects: RecommendationInput[], now = new Date(), limit = 5) {
  return subjects.map((item) => {
    const daysWithoutStudy = item.lastStudiedAt ? Math.max(0, Math.floor((now.getTime() - item.lastStudiedAt.getTime()) / 86_400_000)) : null;
    const performanceGap = Math.max(0, 80 - item.percentage);
    const score = item.weight * 12 + performanceGap + Math.min(30, daysWithoutStudy ?? 30) + (item.status === "NOT_STARTED" ? 25 : item.status === "IN_PROGRESS" ? 10 : 0) + (item.passages === 0 ? 15 : 0);
    const reasons = [
      `peso ${item.weight}`,
      item.passages === 0 ? "ainda não estudado" : `${item.percentage.toFixed(0)}% de domínio`,
      daysWithoutStudy === null ? "sem estudo registrado" : `${daysWithoutStudy} dia${daysWithoutStudy === 1 ? "" : "s"} sem estudo`,
      item.status === "COMPLETED" ? "edital concluído" : item.status === "IN_PROGRESS" ? "edital em andamento" : "edital não iniciado",
    ];
    return { ...item, daysWithoutStudy, score, explanation: `Prioridade calculada por ${reasons.join(", ")}.` };
  }).sort((a, b) => b.score - a.score || b.weight - a.weight || a.subject.localeCompare(b.subject)).slice(0, limit);
}
