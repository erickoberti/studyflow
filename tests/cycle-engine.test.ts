import test from "node:test";
import assert from "node:assert/strict";
import { selectWeightedSubject, simulateWeightedCycle } from "../src/lib/cycle-engine";

const subjects = [
  { id: "a", name: "A", disciplineId: "d", weight: 3, sortOrder: 1, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
  { id: "b", name: "B", disciplineId: "d", weight: 1, sortOrder: 2, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
];

test("seleciona somente assunto ativo fornecido pela disciplina", () => {
  assert.equal(selectWeightedSubject(subjects)?.disciplineId, "d");
  assert.equal(selectWeightedSubject([], undefined), null);
});

test("simulação respeita posição por disciplina e não tem starvation", () => {
  const rows = simulateWeightedCycle([{ disciplineId: "d", discipline: "Disciplina", orderIndex: 1, questionGoal: 20, targetMinutes: 60 }], subjects, 200);
  const count = new Map(rows.map((row) => [row.subjectId, 0])); rows.forEach((row) => count.set(row.subjectId, (count.get(row.subjectId) ?? 0) + 1));
  assert.equal(rows.every((row) => row.discipline === "Disciplina"), true);
  assert.equal((count.get("a") ?? 0) + (count.get("b") ?? 0), 200);
  assert.ok((count.get("b") ?? 0) > 0);
});
