import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { simulateWeightedCycle } from "../src/lib/cycle-engine";

test("importador persiste disciplina na posição e ordem interna do assunto", () => {
  const route = readFileSync(resolve(process.cwd(), "src/app/api/import/base/route.ts"), "utf8");
  assert.match(route, /subjectOrderByDiscipline/);
  assert.ok((route.match(/sortOrder: subjectSortOrder/g) ?? []).length >= 2);
  assert.ok((route.match(/disciplineId: discipline\.id/g) ?? []).length >= 2);
});

test("posições intercaladas com pesos iguais percorrem os assuntos na ordem", () => {
  const subjects = [
    { id: "p1", name: "Português 1", disciplineId: "p", weight: 1, sortOrder: 1, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
    { id: "p2", name: "Português 2", disciplineId: "p", weight: 1, sortOrder: 2, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
    { id: "s1", name: "SUS 1", disciplineId: "s", weight: 1, sortOrder: 1, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
    { id: "s2", name: "SUS 2", disciplineId: "s", weight: 1, sortOrder: 2, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
    { id: "m1", name: "Psicologia 1", disciplineId: "m", weight: 1, sortOrder: 1, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
    { id: "m2", name: "Psicologia 2", disciplineId: "m", weight: 1, sortOrder: 2, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null },
  ];
  const positions = ["p", "s", "m", "p", "s", "m"].map((disciplineId, index) => ({ disciplineId, discipline: disciplineId, orderIndex: index + 1, questionGoal: 20, targetMinutes: 60 }));
  assert.deepEqual(simulateWeightedCycle(positions, subjects, 6).map((row) => row.subjectId), ["p1", "s1", "m1", "p2", "s2", "m2"]);
});
