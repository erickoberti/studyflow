import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { CycleService } from "../src/lib/cycle-service";
import { prisma } from "../src/lib/prisma";

function mockStart(t: TestContext, options: { processed?: boolean; existing?: boolean; invalidSubject?: boolean; rollback?: boolean } = {}) {
  const calls: string[] = [];
  const discipline = { id: "discipline", name: "Segurança", active: true, questionGoal: 1 };
  const subject = { id: "subject", name: "SAST versus DAST", active: true, disciplineId: discipline.id, weight: 1, sortOrder: 1, progress: null };
  const entry = { id: "entry", orderIndex: 8, active: true, disciplineId: discipline.id };
  const program = {
    id: "program", status: "ACTIVE", currentRound: 1, totalRounds: 4,
    items: Array.from({ length: 76 }, (_, index) => ({
      id: `item-${index + 1}`, roundNumber: Math.floor(index / 19) + 1,
      entryId: entry.id, entry: { ...entry, orderIndex: index % 19 + 1 },
      disciplineId: discipline.id, discipline, subjectId: subject.id, subject,
      questionGoal: 1, completion: null,
    })),
  };
  let data: Record<string, unknown> = {};
  let committed = false;
  const tx = {
    $queryRaw: async () => { calls.push("lock"); return [{ id: "guide" }]; },
    activeStudySession: {
      findFirst: async ({ where }: { where: { id?: string } }) => {
        calls.push("lookup");
        if ((where.id && options.processed) || (!where.id && options.existing)) return { id: "active", programItemId: "item-8" };
        return null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push("create");
        data = args.data;
        return { id: "active" };
      },
      // Display reads deliberately do not belong to the transaction client.
      findUnique: async () => { assert.fail("Dados de exibição devem ser lidos após o commit."); },
    },
    cycleProgram: { findFirst: async () => { calls.push("program"); return program; } },
    studyGuideCycleState: { findUnique: async () => ({ currentOrderIndex: 8, roundNumber: 1 }) },
    subject: { findFirst: async ({ where }: { where: object }) => {
      assert.deepEqual(where, { id: "subject", userId: "user", studyGuideId: "guide", disciplineId: "discipline", active: true });
      return options.invalidSubject ? null : subject;
    } },
  };
  const originalTransaction = prisma.$transaction;
  const originalRead = prisma.activeStudySession.findUnique;
  t.after(() => {
    prisma.$transaction = originalTransaction;
    prisma.activeStudySession.findUnique = originalRead;
  });
  prisma.$transaction = (async (callback: (client: unknown) => Promise<unknown>, config?: { timeout?: number }) => {
    // A start taking as long as the production failure must not use the 5s default.
    assert.equal(config?.timeout, 20_000);
    const result = await callback(tx);
    if (options.rollback) throw new Error("Falha no commit");
    committed = true;
    calls.push("commit");
    return result;
  }) as typeof prisma.$transaction;
  prisma.activeStudySession.findUnique = (async ({ where }: { where: { id: string } }) => {
    assert.equal(committed, true, "A leitura de exibição não pode preceder o commit.");
    assert.equal(where.id, "active");
    calls.push("display");
    return {
      id: "active", mode: data.mode ?? "CYCLE", status: data.status ?? "PAUSED", version: 1,
      startedAt: new Date("2026-11-17T12:00:00Z"), accumulatedSeconds: 0, pausedAt: data.pausedAt ?? null,
      discipline, subject, cycleEntry: data.mode === "AVULSO" ? null : entry,
      programItem: data.mode === "AVULSO" ? null : { roundNumber: 1, questionGoal: 1, program },
      studyGuide: { cycleState: { roundNumber: 1 } },
    };
  }) as unknown as typeof originalRead;
  return { calls, get data() { return data; } };
}

test("registro manual no ciclo 19×4 inicia pausado, com prazo remoto e exibição após commit", async (t) => {
  const fake = mockStart(t);
  const session = await new CycleService().start("user", "guide", { mode: "CYCLE", timerRunning: false });
  assert.equal(session?.status, "PAUSED");
  assert.deepEqual(session?.cycle, { entryId: "entry", position: 8, round: 1, totalRounds: 4 });
  assert.equal(session?.discipline.questionGoal, 1);
  assert.equal(session?.subject.name, "SAST versus DAST");
  assert.equal(fake.data.programItemId, "item-8");
  assert.equal(fake.data.subjectId, "subject");
  assert.equal(fake.data.pausedAt, null);
  assert.ok(fake.calls.indexOf("lock") < fake.calls.indexOf("create"));
  assert.deepEqual(fake.calls.slice(-3), ["create", "commit", "display"]);
});

test("cronômetro avulso inicia ativo sem alterar ou consultar a programação", async (t) => {
  const fake = mockStart(t);
  const session = await new CycleService().start("user", "guide", { mode: "AVULSO", disciplineId: "discipline", subjectId: "subject" });
  assert.equal(session?.status, "ACTIVE");
  assert.equal(session?.cycle, null);
  assert.ok(fake.data.pausedAt instanceof Date);
  assert.equal(fake.data.cycleEntryId, undefined);
  assert.ok(!fake.calls.includes("program"));
});

test("repetição de operação offline devolve a mesma sessão sem criar outra", async (t) => {
  const fake = mockStart(t, { processed: true });
  const session = await new CycleService().start("user", "guide", { mode: "CYCLE", operationId: "offline-start", timerRunning: false });
  assert.equal(session?.id, "active");
  assert.deepEqual(fake.calls, ["lock", "lookup", "commit", "display"]);
});

test("sessão já aberta é retomada sem duplicação", async (t) => {
  const fake = mockStart(t, { existing: true });
  const session = await new CycleService().start("user", "guide", { mode: "CYCLE", expectedProgramItemId: "item-8" });
  assert.equal(session?.id, "active");
  assert.deepEqual(fake.calls, ["lock", "lookup", "commit", "display"]);
});

test("sessão aberta em outra posição preserva o conflito offline", async (t) => {
  const fake = mockStart(t, { existing: true });
  await assert.rejects(new CycleService().start("user", "guide", { mode: "CYCLE", expectedProgramItemId: "item-9" }), { code: "PROGRAM_ITEM_CHANGED" });
  assert.deepEqual(fake.calls, ["lock", "lookup"]);
});

test("mudança na programação rejeita início offline sem criar sessão", async (t) => {
  const fake = mockStart(t);
  await assert.rejects(new CycleService().start("user", "guide", { mode: "CYCLE", expectedProgramItemId: "item-9" }), { code: "PROGRAM_ITEM_CHANGED" });
  assert.ok(!fake.calls.includes("create"));
  assert.ok(!fake.calls.includes("display"));
});

test("assunto inválido não cria sessão nem consulta exibição", async (t) => {
  const fake = mockStart(t, { invalidSubject: true });
  await assert.rejects(new CycleService().start("user", "guide", { mode: "AVULSO", disciplineId: "discipline", subjectId: "subject" }), /não pertence/);
  assert.ok(!fake.calls.includes("create"));
  assert.ok(!fake.calls.includes("display"));
});

test("falha no commit é propagada sem devolver sessão não confirmada", async (t) => {
  const fake = mockStart(t, { rollback: true });
  await assert.rejects(new CycleService().start("user", "guide", { mode: "CYCLE" }), /Falha no commit/);
  assert.ok(fake.calls.includes("create"));
  assert.ok(!fake.calls.includes("display"));
});
