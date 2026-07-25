import { prisma } from "@/lib/prisma";
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

export async function getCycleDebug(userId: string, studyGuideId: string, total = 0) {
  const [disciplines, entries, subjects] = await Promise.all([
    prisma.discipline.findMany({ where: { userId, studyGuideId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cycleEntry.findMany({ where: { userId, studyGuideId, active: true }, orderBy: { orderIndex: "asc" } }),
    prisma.subject.findMany({ where: { userId, studyGuideId, active: true }, include: { progress: true }, orderBy: { sortOrder: "asc" } }),
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
  const simulation: Array<{ session: number; discipline: string; subject: string }> = [];
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
    simulation.push({ session: index + 1, discipline: disciplines.find((item) => item.id === entry.disciplineId)?.name ?? "Disciplina", subject: selected.name });
  }
  const counts = new Map<string, number>();
  simulation.forEach((item) => counts.set(item.subject, (counts.get(item.subject) ?? 0) + 1));
  const validator = total ? validateSimulation(simulation.map((row, index) => ({ ...row, position: index + 1, round: 1, subjectId: subjects.find((subject) => subject.name === row.subject)?.id ?? "", weight: 0, targetMinutes: 60, questionGoal: 20 })), subjects) : null;
  return { details, simulation, distribution: subjects.map((subject) => ({ subject: subject.name, count: counts.get(subject.name) ?? 0, percentage: total ? ((counts.get(subject.name) ?? 0) / total) * 100 : 0 })), allAppeared: total > 0 && subjects.every((subject) => (counts.get(subject.name) ?? 0) > 0), validator };
}
