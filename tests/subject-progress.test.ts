import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { advanceSubjectWeights, recalculateSubjectProgress } from "../src/lib/subject-progress";
import { advanceWeightedState } from "../src/lib/cycle-engine";

test("pesos em lote preservam o algoritmo com progresso existente e novos assuntos", async () => {
  const subjects = Array.from({ length: 120 }, (_, index) => ({
    id: `subject-${index}`, name: `Assunto ${index}`, disciplineId: "discipline",
    weight: index % 3 + 1, sortOrder: index, currentWeight: index % 2 ? index - 40 : 0,
    passages: 0, averagePercentage: 0, lastStudiedAt: null,
  }));
  const weights = new Map(subjects.filter((_, index) => index % 2).map((subject) => [subject.id, subject.currentWeight]));
  let writes = 0;
  const tx = {
    subjectProgress: {
      createMany: async ({ data, skipDuplicates }: Prisma.SubjectProgressCreateManyArgs) => {
        writes++;
        assert.equal(skipDuplicates, true);
        for (const item of Array.isArray(data) ? data : [data]) {
          assert.equal(item.userId, "user");
          assert.equal(item.studyGuideId, "guide");
          if (!weights.has(item.subjectId)) weights.set(item.subjectId, 0);
        }
      },
      updateMany: async (args: { where: { userId: string; studyGuideId: string; subjectId: { in: string[] } }; data: { currentWeight: { increment: number } } }) => {
        writes++;
        assert.equal(args.where.userId, "user");
        assert.equal(args.where.studyGuideId, "guide");
        for (const id of args.where.subjectId.in) weights.set(id, weights.get(id)! + args.data.currentWeight.increment);
      },
    },
  } as unknown as Prisma.TransactionClient;
  for (const selectedId of ["subject-0", "subject-71"]) {
    const prior = subjects.map((subject) => ({ ...subject, currentWeight: weights.get(subject.id) ?? 0 }));
    await advanceSubjectWeights(tx, "user", "guide", subjects, selectedId);
    for (const expected of advanceWeightedState(prior, selectedId)) assert.equal(weights.get(expected.id), expected.currentWeight);
  }
  assert.equal(writes, 10, "120 assuntos exigem só cinco escritas por avanço");
});

test("ciclo com um único assunto mantém seu peso acumulado", async () => {
  let writes = 0;
  const tx = { subjectProgress: {
    createMany: async () => { writes++; },
    updateMany: async () => { assert.fail("O incremento líquido deve ser zero"); },
  } } as unknown as Prisma.TransactionClient;
  await advanceSubjectWeights(tx, "user", "guide", [], "subject");
  assert.equal(writes, 0);
  await advanceSubjectWeights(tx, "user", "guide", [{ id: "subject", weight: 3 }], "subject");
  assert.equal(writes, 1);
});

test("recálculo usa o histórico após edição ou exclusão sem alterar o peso do ciclo", async () => {
  const updates: Array<{ where: { subjectId: string }; create: Record<string, unknown>; update: Record<string, unknown> }> = [];
  const order: string[] = [];
  const lastDate = new Date("2026-09-29T15:00:00.000Z");
  const tx = {
    $queryRaw: async () => { order.push("lock"); return [{ id: "old" }, { id: "new" }]; },
    studySession: { groupBy: async () => { order.push("history"); return [{ subjectId: "new", _count: { id: 2 }, _sum: { questions: 20, correct: 15, wrong: 5 }, _max: { date: lastDate } }]; } },
    subjectProgress: { upsert: async (args: typeof updates[number]) => { order.push("progress"); updates.push(args); } },
  } as unknown as Prisma.TransactionClient;
  await recalculateSubjectProgress(tx, "user", "guide", ["old", "new", "new"]);
  assert.equal(updates.length, 2);
  assert.deepEqual(order, ["lock", "history", "progress", "progress"]);
  assert.deepEqual(updates[0].update, { passages: 0, totalQuestions: 0, correct: 0, wrong: 0, averagePercentage: 0, lastStudiedAt: null });
  assert.deepEqual(updates[1].update, { passages: 2, totalQuestions: 20, correct: 15, wrong: 5, averagePercentage: 75, lastStudiedAt: lastDate });
  assert.equal("currentWeight" in updates[1].update, false);
});
