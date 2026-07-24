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
