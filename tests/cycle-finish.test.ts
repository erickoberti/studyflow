import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { CycleService } from "../src/lib/cycle-service";
import { prisma } from "../src/lib/prisma";

const input = { questions: 34, correct: 24, minutes: 60 };

function mockTransaction(t: TestContext, implementation: (callback: (tx: unknown) => Promise<unknown>, options: { timeout: number }) => Promise<unknown>) {
  // Prisma exposes methods through a proxy, without ordinary property descriptors.
  const original = prisma.$transaction;
  prisma.$transaction = implementation as typeof prisma.$transaction;
  const restore = () => { prisma.$transaction = original; };
  t.after(restore);
  return restore;
}

function fakeTransaction(options: { mode?: string; completed?: boolean; conflict?: boolean } = {}) {
  const calls: string[] = [];
  let saved: Record<string, unknown> | undefined;
  const tx = {
    $queryRaw: async () => { calls.push("lock"); return [{ id: "subject" }]; },
    activeStudySession: {
      findFirst: async () => ({
        id: "active", userId: "user", studyGuideId: "guide", disciplineId: "discipline",
        subjectId: "subject", cycleEntryId: "entry", mode: options.mode ?? "CYCLE",
        status: "PAUSED", version: 1, accumulatedSeconds: 3600,
        completedSession: options.completed ? { id: "saved", ...input, estimatedMinutes: 60 } : null,
      }),
      updateMany: async () => { calls.push("finishing"); return { count: 1 }; },
      update: async () => { calls.push("finished"); },
    },
    cycleEntry: { findUnique: async () => ({ orderIndex: 18 }), findFirst: async () => ({ orderIndex: 20 }) },
    subject: { findMany: async () => [{ id: "subject", weight: 2 }, { id: "other", weight: 1 }] },
    studySession: {
      create: async ({ data }: { data: Record<string, unknown> }) => { calls.push("history"); saved = data; return { id: "saved" }; },
      groupBy: async () => [{ subjectId: "subject", _count: { id: 1 }, _sum: { questions: 34, correct: 24, wrong: 10 }, _max: { date: new Date() } }],
    },
    subjectProgress: {
      createMany: async () => { calls.push("weights-create"); },
      updateMany: async () => { calls.push("weights-update"); },
      upsert: async () => { calls.push("totals"); },
    },
    reviewSchedule: {
      updateMany: async () => { calls.push("reviews"); },
      count: async () => 0,
      createMany: async () => { calls.push("schedule"); },
    },
    studyGuideCycleState: {
      findUnique: async () => ({ id: "state", version: 1 }),
      updateMany: async ({ data }: { data: { currentOrderIndex: number } }) => {
        assert.equal(data.currentOrderIndex, 19);
        calls.push("cursor");
        return { count: options.conflict ? 0 : 1 };
      },
    },
  };
  return { tx, calls, get saved() { return saved; } };
}

test("finalização salva os resultados e avança o ciclo com prazo explícito e um recálculo", async (t) => {
  const fake = fakeTransaction();
  mockTransaction(t, async (callback: (tx: unknown) => Promise<unknown>, options: { timeout: number }) => {
    assert.equal(options.timeout, 20_000);
    return callback(fake.tx);
  });
  assert.deepEqual(await new CycleService().finish("user", "guide", "active", 1, input), { sessionId: "saved", idempotent: false });
  assert.equal(fake.saved?.wrong, 10);
  assert.equal(fake.saved?.estimatedMinutes, 60);
  assert.equal(fake.saved?.cyclePosition, 18);
  assert.equal(fake.calls.filter((call) => call === "totals").length, 1);
  assert.ok(fake.calls.indexOf("lock") < fake.calls.indexOf("weights-update"));
  assert.deepEqual(fake.calls.slice(-2), ["cursor", "finished"]);
});

test("não altera pesos ou cursor ao continuar no assunto ou finalizar avulso", async (t) => {
  for (const mode of ["CYCLE", "AVULSO"]) {
    const fake = fakeTransaction({ mode });
    const mock = mockTransaction(t, async (callback: (tx: unknown) => Promise<unknown>) => callback(fake.tx));
    await new CycleService().finish("user", "guide", "active", 1, { ...input, advanceCycle: mode !== "CYCLE" });
    assert.equal(fake.saved?.cyclePosition, null);
    assert.ok(fake.calls.includes("totals"));
    assert.ok(!fake.calls.includes("weights-create"));
    assert.ok(!fake.calls.includes("cursor"));
    mock();
  }
});

test("repetir finalização não duplica histórico nem avança novamente", async (t) => {
  const fake = fakeTransaction({ completed: true });
  mockTransaction(t, async (callback: (tx: unknown) => Promise<unknown>) => callback(fake.tx));
  assert.deepEqual(await new CycleService().finish("user", "guide", "active", 1, input), { sessionId: "saved", idempotent: true });
  assert.deepEqual(fake.calls, []);
});

test("conflito de cursor rejeita a transação antes de marcar a sessão como finalizada", async (t) => {
  const fake = fakeTransaction({ conflict: true });
  mockTransaction(t, async (callback: (tx: unknown) => Promise<unknown>) => callback(fake.tx));
  await assert.rejects(new CycleService().finish("user", "guide", "active", 1, input), { code: "CYCLE_VERSION_CHANGED" });
  assert.ok(!fake.calls.includes("finished"));
});
