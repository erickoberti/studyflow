import { prisma } from "@/lib/prisma";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { validateSimulation } from "@/lib/cycle-engine";

type Item = { id: string; name: string; weight: number; sortOrder: number; currentWeight: number; passages: number; averagePercentage: number; lastStudiedAt: Date | null };

function rank(items: Item[], lastId?: string) {
  const candidates = items.length > 1 ? items.filter((item) => item.id !== lastId) : items;
  return [...(candidates.length ? candidates : items)].sort((a, b) => {
    const score = (b.currentWeight + b.weight) - (a.currentWeight + a.weight);
    if (score) return score;
    const last = (a.lastStudiedAt?.getTime() ?? 0) - (b.lastStudiedAt?.getTime() ?? 0);
    if (last) return last;
    if (a.averagePercentage !== b.averagePercentage) return a.averagePercentage - b.averagePercentage;
    if (a.passages !== b.passages) return a.passages - b.passages;
    return a.sortOrder - b.sortOrder;
  })[0];
}

export function buildQuestionProjection(input: {
  now: Date;
  examDate: Date | null;
  dailyQuestionsGoal: number;
  completedQuestions: number;
  firstSessionAt: Date | null;
}) {
  const millisecondsRemaining = input.examDate ? input.examDate.getTime() - input.now.getTime() : 0;
  const daysRemaining = input.examDate ? Math.max(0, Math.ceil(millisecondsRemaining / 86_400_000)) : null;
  const dailyQuestionsGoal = Math.max(0, input.dailyQuestionsGoal);
  const completedQuestions = Math.max(0, input.completedQuestions);
  const elapsedDays = input.firstSessionAt
    ? Math.max(1, Math.ceil((input.now.getTime() - input.firstSessionAt.getTime()) / 86_400_000) + 1)
    : 0;
  const currentDailyAverage = elapsedDays ? completedQuestions / elapsedDays : 0;
  const additionalQuestions = daysRemaining === null ? null : daysRemaining * dailyQuestionsGoal;
  const projectedTotal = additionalQuestions === null ? null : completedQuestions + additionalQuestions;
  const additionalAtCurrentPace = daysRemaining === null ? null : Math.round(daysRemaining * currentDailyAverage);

  return {
    examDate: input.examDate,
    daysRemaining,
    dailyQuestionsGoal,
    completedQuestions,
    elapsedDays,
    currentDailyAverage,
    additionalQuestions,
    projectedTotal,
    additionalAtCurrentPace,
    projectedAtCurrentPace: additionalAtCurrentPace === null ? null : completedQuestions + additionalAtCurrentPace,
  };
}

export async function getCycleDebug(userId: string, studyGuideId: string, total = 0) {
  const [disciplines, entries, subjects, settings, questionAggregate] = await Promise.all([
    prisma.discipline.findMany({ where: { userId, studyGuideId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cycleEntry.findMany({ where: { userId, studyGuideId, active: true }, orderBy: { orderIndex: "asc" } }),
    prisma.subject.findMany({ where: { userId, studyGuideId, active: true }, include: { progress: true }, orderBy: { sortOrder: "asc" } }),
    getStudyGuideSettings(userId, studyGuideId),
    prisma.studySession.aggregate({
      where: { userId, studyGuideId },
      _sum: { questions: true },
      _min: { date: true },
    }),
  ]);
  const byDiscipline = new Map<string, Item[]>();
  for (const subject of subjects) {
    const item: Item = { id: subject.id, name: subject.name, weight: subject.weight, sortOrder: subject.sortOrder, currentWeight: subject.progress?.currentWeight ?? 0, passages: subject.progress?.passages ?? 0, averagePercentage: subject.progress?.averagePercentage ?? 0, lastStudiedAt: subject.progress?.lastStudiedAt ?? null };
    byDiscipline.set(subject.disciplineId, [...(byDiscipline.get(subject.disciplineId) ?? []), item]);
  }
  const details = disciplines.map((discipline) => ({
    discipline,
    subjects: (byDiscipline.get(discipline.id) ?? []).map((item) => ({ ...item, score: item.currentWeight + item.weight, nextPriority: rank(byDiscipline.get(discipline.id) ?? [])?.id === item.id })),
  }));
  const simulation: Array<{ session: number; discipline: string; subject: string; subjectId: string }> = [];
  const virtual = new Map([...byDiscipline.entries()].map(([id, list]) => [id, list.map((item) => ({ ...item }))]));
  const lastByDiscipline = new Map<string, string>();
  for (let index = 0; index < total; index += 1) {
    const entry = entries[index % Math.max(entries.length, 1)];
    if (!entry?.disciplineId) continue;
    const candidates = virtual.get(entry.disciplineId) ?? [];
    const selected = rank(candidates, lastByDiscipline.get(entry.disciplineId));
    if (!selected) continue;
    const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
    candidates.forEach((item) => { item.currentWeight += item.weight - (item.id === selected.id ? totalWeight : 0); });
    lastByDiscipline.set(entry.disciplineId, selected.id);
    simulation.push({ session: index + 1, discipline: disciplines.find((item) => item.id === entry.disciplineId)?.name ?? "Disciplina", subject: selected.name, subjectId: selected.id });
  }
  const counts = new Map<string, number>();
  simulation.forEach((item) => counts.set(item.subjectId, (counts.get(item.subjectId) ?? 0) + 1));
  const validator = total ? validateSimulation(simulation.map((row, index) => ({ ...row, position: index + 1, round: 1, weight: 0, targetMinutes: 60, questionGoal: 20 })), subjects) : null;
  const questionProjection = buildQuestionProjection({
    now: new Date(),
    examDate: settings.examDate,
    dailyQuestionsGoal: settings.dailyQuestionsGoal,
    completedQuestions: questionAggregate._sum.questions ?? 0,
    firstSessionAt: questionAggregate._min.date,
  });
  return { details, simulation, distribution: subjects.map((subject) => ({ subject: subject.name, discipline: disciplines.find((item) => item.id === subject.disciplineId)?.name ?? "Disciplina", count: counts.get(subject.id) ?? 0, percentage: total ? ((counts.get(subject.id) ?? 0) / total) * 100 : 0 })), allAppeared: total > 0 && subjects.every((subject) => (counts.get(subject.id) ?? 0) > 0), validator, questionProjection };
}
