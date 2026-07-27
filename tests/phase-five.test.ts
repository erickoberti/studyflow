import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildExamPlan, buildExplainableRecommendations, distributeQuestionsByWeight, summarizeMockExam } from "../src/lib/phase-five";

test("distribuição por peso preserva exatamente o total", () => {
  const result = distributeQuestionsByWeight(20, [{ id: "a", name: "A", weight: 3 }, { id: "b", name: "B", weight: 2 }, { id: "c", name: "C", weight: 1 }]);
  assert.equal(result.reduce((sum, item) => sum + item.questions, 0), 20);
  assert.ok(result.find((item) => item.id === "a")!.questions > result.find((item) => item.id === "b")!.questions);
  assert.ok(result.find((item) => item.id === "b")!.questions > result.find((item) => item.id === "c")!.questions);
});

test("distribuição usa maior resto sem perder questões", () => {
  const result = distributeQuestionsByWeight(7, [{ id: "a", name: "A", weight: 1 }, { id: "b", name: "B", weight: 1 }, { id: "c", name: "C", weight: 1 }]);
  assert.deepEqual(result.map((item) => item.questions).sort(), [2, 2, 3]);
});

test("resumo do simulado deriva erros e percentual", () => {
  assert.deepEqual(summarizeMockExam([{ questions: 20, correct: 15 }, { questions: 10, correct: 5 }]), { totalQuestions: 30, correct: 20, wrong: 10, percentage: 20 / 30 * 100 });
  assert.throws(() => summarizeMockExam([{ questions: 5, correct: 6 }]));
});

test("planejamento calcula capacidade até a prova", () => {
  const plan = buildExamPlan({ now: new Date("2026-01-01T00:00:00Z"), examDate: new Date("2026-01-29T00:00:00Z"), totalSubjects: 20, completedSubjects: 8, inProgressSubjects: 3, weeklyQuestionsGoal: 200, sessionMinutes: 60, questionsPerSession: 20 });
  assert.equal(plan.daysRemaining, 28); assert.equal(plan.weeksRemaining, 4); assert.equal(plan.questionsUntilExam, 800); assert.equal(plan.sessionsPerWeek, 10); assert.equal(plan.coveragePercentage, 40);
});

test("recomendações possuem score e explicação auditável", () => {
  const recommendations = buildExplainableRecommendations([
    { subjectId: "forte", subject: "Forte", discipline: "D", weight: 1, status: "COMPLETED", percentage: 90, passages: 5, lastStudiedAt: new Date("2026-01-09") },
    { subjectId: "prioritario", subject: "Prioritário", discipline: "D", weight: 3, status: "NOT_STARTED", percentage: 0, passages: 0, lastStudiedAt: null },
  ], new Date("2026-01-10"));
  assert.equal(recommendations[0].subjectId, "prioritario"); assert.match(recommendations[0].explanation, /peso 3/); assert.match(recommendations[0].explanation, /não estudado/);
});

test("API de simulados permanece isolada do ciclo e das sessões comuns", () => {
  const route = readFileSync(resolve(process.cwd(), "src/app/api/mock-exams/route.ts"), "utf8");
  assert.match(route, /prisma\.mockExam\.create/);
  assert.doesNotMatch(route, /studySession\.(?:create|update|delete)/);
  assert.doesNotMatch(route, /studyGuideCycleState\.(?:create|update|delete|upsert)/);
  assert.doesNotMatch(route, /subjectProgress\.(?:create|update|delete|upsert)/);
});

test("migration da fase 5 é aditiva", () => {
  const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260726120000_phase5_exam_planning/migration.sql"), "utf8");
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|COLUMN|TYPE)|TRUNCATE|DELETE\s+FROM/i);
  assert.match(migration, /CREATE TABLE "MockExam"/); assert.match(migration, /CREATE TABLE "SyllabusProgress"/);
});
