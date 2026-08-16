import test from "node:test";
import assert from "node:assert/strict";
import { simulateWeightedCycle, validateSimulation } from "../src/lib/cycle-engine";
import { buildQuestionProjection } from "../src/lib/cycle-debug";
const subjects = [{ id: "a", name: "A", disciplineId: "d", weight: 2, sortOrder: 1, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null }, { id: "b", name: "B", disciplineId: "d", weight: 1, sortOrder: 2, currentWeight: 0, passages: 0, averagePercentage: 0, lastStudiedAt: null }];
test("validador confirma cobertura em 200 sessões sem persistência", () => { const rows = simulateWeightedCycle([{ disciplineId: "d", discipline: "D", orderIndex: 1, questionGoal: 20, targetMinutes: 60 }], subjects, 200); const report = validateSimulation(rows, subjects); assert.equal(report.pass, true); assert.equal(report.missing.length, 0); assert.equal(rows.length, 200); });

test("projeção soma o histórico às questões possíveis até a prova", () => {
  const projection = buildQuestionProjection({
    now: new Date("2026-01-01T12:00:00.000Z"),
    examDate: new Date("2026-01-29T12:00:00.000Z"),
    dailyQuestionsGoal: 30,
    completedQuestions: 120,
    firstSessionAt: new Date("2025-12-29T12:00:00.000Z"),
  });
  assert.equal(projection.daysRemaining, 28);
  assert.equal(projection.additionalQuestions, 840);
  assert.equal(projection.projectedTotal, 960);
  assert.equal(projection.currentDailyAverage, 30);
});
