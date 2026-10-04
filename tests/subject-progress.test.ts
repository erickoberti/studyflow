import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { recalculateSubjectProgress } from "../src/lib/subject-progress";

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
