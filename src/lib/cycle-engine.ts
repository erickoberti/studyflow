export type CycleEngineSubject = {
  id: string; name: string; disciplineId: string; weight: number; sortOrder: number;
  currentWeight: number; passages: number; averagePercentage: number; lastStudiedAt: Date | null;
};

export function selectWeightedSubject(subjects: CycleEngineSubject[], lastSubjectId?: string) {
  const eligible = subjects.length > 1 ? subjects.filter((item) => item.id !== lastSubjectId) : subjects;
  return [...(eligible.length ? eligible : subjects)].sort((a, b) => {
    const score = (b.currentWeight + b.weight) - (a.currentWeight + a.weight);
    if (score) return score;
    const last = (a.lastStudiedAt?.getTime() ?? 0) - (b.lastStudiedAt?.getTime() ?? 0);
    if (last) return last;
    if (a.averagePercentage !== b.averagePercentage) return a.averagePercentage - b.averagePercentage;
    if (a.passages !== b.passages) return a.passages - b.passages;
    return a.sortOrder - b.sortOrder;
  })[0] ?? null;
}

export function advanceWeightedState(subjects: CycleEngineSubject[], selectedId: string) {
  const totalWeight = subjects.reduce((sum, item) => sum + item.weight, 0);
  return subjects.map((item) => ({ ...item, currentWeight: item.currentWeight + item.weight - (item.id === selectedId ? totalWeight : 0) }));
}

export function simulateWeightedCycle(
  positions: Array<{ disciplineId: string; discipline: string; orderIndex: number; questionGoal: number; targetMinutes: number }>,
  initialSubjects: CycleEngineSubject[], total: number,
) {
  let subjects = initialSubjects.map((item) => ({ ...item }));
  const lastByDiscipline = new Map<string, string>();
  return Array.from({ length: total }, (_, index) => {
    const position = positions[index % positions.length];
    const candidates = subjects.filter((item) => item.disciplineId === position.disciplineId);
    const selected = selectWeightedSubject(candidates, lastByDiscipline.get(position.disciplineId));
    if (!selected) throw new Error(`Disciplina sem assunto ativo: ${position.discipline}`);
    const updated = advanceWeightedState(candidates, selected.id);
    const map = new Map(updated.map((item) => [item.id, item]));
    subjects = subjects.map((item) => map.get(item.id) ?? item);
    lastByDiscipline.set(position.disciplineId, selected.id);
    return { session: index + 1, position: position.orderIndex, round: Math.floor(index / positions.length) + 1, discipline: position.discipline, subject: selected.name, subjectId: selected.id, weight: selected.weight, targetMinutes: position.targetMinutes, questionGoal: position.questionGoal };
  });
}

export function validateSimulation(rows: ReturnType<typeof simulateWeightedCycle>, expectedSubjects: Array<{ id: string; name: string; weight: number }>) {
  const counts = new Map(rows.map((row) => [row.subjectId, 0])); rows.forEach((row) => counts.set(row.subjectId, (counts.get(row.subjectId) ?? 0) + 1));
  const missing = expectedSubjects.filter((subject) => !(counts.get(subject.id) ?? 0)).map((subject) => subject.name);
  const intervals = new Map<string, number[]>(); rows.forEach((row, index) => intervals.set(row.subjectId, [...(intervals.get(row.subjectId) ?? []), index + 1]));
  const maxGap = Math.max(0, ...[...intervals.values()].flatMap((list) => list.slice(1).map((value, index) => value - list[index])));
  return { pass: missing.length === 0 && rows.length > 0, missing, maxGap, counts: Object.fromEntries(counts), messages: missing.length ? [`Assuntos sem seleção: ${missing.join(", ")}`] : ["Todos os assuntos ativos apareceram na simulação."] };
}
