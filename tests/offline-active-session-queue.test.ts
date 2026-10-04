import assert from "node:assert/strict";
import test from "node:test";
import { completedOperationIdsToPrune, createOfflineSessionOperation, createStandaloneOfflineSession, MemoryOfflineSessionQueue, pruneCompletedOfflineOperations, queueOfflineSessionOperation, startOfflineActiveSession } from "../src/lib/offline/active-session-queue";

const base = {
  localSessionId: "local-1", serverSessionId: null, serverVersion: null, mode: "CYCLE" as const,
  disciplineId: "discipline-1", subjectId: "subject-1", cycleEntryId: "entry-1",
  disciplineName: "Desenvolvimento", subjectName: "APIs", startedAt: "2026-07-25T10:00:00.000Z",
  pausedAt: "2026-07-25T10:00:00.000Z", finishedAt: null, accumulatedSeconds: 0,
  questions: 0, correct: 0, wrong: 0, difficulty: null, notes: null, date: "2026-07-25T10:00:00.000Z",
};

test("gera operationId único para cada operação", () => {
  const first = createOfflineSessionOperation({ userId: "user-1", studyGuideId: "guide-1", type: "START_SESSION", payload: base });
  const second = createOfflineSessionOperation({ userId: "user-1", studyGuideId: "guide-1", type: "START_SESSION", payload: base });
  assert.notEqual(first.operationId, second.operationId);
});

test("retenção remove só confirmações antigas sem dependente e preserva outras contas", async () => {
  const state = { operations: new Map(), sessions: new Map() };
  const storage = new MemoryOfflineSessionQueue(state);
  const old = createOfflineSessionOperation({ operationId: "old", userId: "user-1", studyGuideId: "guide-1", type: "START_SESSION", payload: base });
  const dependency = createOfflineSessionOperation({ operationId: "dependency", dependsOnOperationId: "old", userId: "user-1", studyGuideId: "guide-1", type: "FINISH_SESSION", payload: base });
  const removable = createOfflineSessionOperation({ operationId: "removable", userId: "user-1", studyGuideId: "guide-1", type: "CREATE_STANDALONE_SESSION", payload: { ...base, mode: "AVULSO" } });
  const otherAccount = createOfflineSessionOperation({ operationId: "other", userId: "user-2", studyGuideId: "guide-2", type: "START_SESSION", payload: base });
  for (const operation of [old, dependency, removable, otherAccount]) await storage.putOperation(operation);
  for (const id of ["old", "removable", "other"]) await storage.updateOperation(id, { status: "COMPLETED", syncedAt: "2026-01-01T00:00:00Z" });
  const now = new Date("2026-10-03T00:00:00Z");
  assert.deepEqual(completedOperationIdsToPrune(await storage.getOperations("user-1", "guide-1"), now), ["removable"]);
  assert.equal(await pruneCompletedOfflineOperations(storage, "user-1", "guide-1", now), 1);
  const afterRestart = new MemoryOfflineSessionQueue(state);
  assert.deepEqual((await afterRestart.getOperations("user-1", "guide-1")).map((item) => item.operationId), ["old", "dependency"]);
  assert.equal((await storage.getOperations("user-2", "guide-2")).length, 1);
});

test("retenção mantém a origem de sessão ativa antiga para operações futuras", async () => {
  const storage = new MemoryOfflineSessionQueue();
  const operation = createOfflineSessionOperation({ operationId: "start-old", userId: "user-1", studyGuideId: "guide-1", type: "START_SESSION", payload: base });
  await storage.putOperation(operation);
  await storage.updateOperation(operation.operationId, { status: "COMPLETED", syncedAt: "2026-01-01T00:00:00Z" });
  await storage.putSession({ ...base, userId: "user-1", studyGuideId: "guide-1", status: "PAUSED", updatedAt: "2026-01-01T00:00:00Z", pendingSync: false });
  assert.equal(await pruneCompletedOfflineOperations(storage, "user-1", "guide-1", new Date("2026-10-03T00:00:00Z")), 0);
  assert.equal((await storage.getOperations("user-1", "guide-1")).length, 1);
});

test("aceita todos os comandos previstos da sessão ativa", () => {
  const types = ["START_SESSION", "PAUSE_SESSION", "RESUME_SESSION", "FINISH_SESSION", "CANCEL_SESSION", "CREATE_STANDALONE_SESSION"] as const;
  const operations = types.map((type) => createOfflineSessionOperation({ userId: "user-1", studyGuideId: "guide-1", type, payload: { ...base, mode: type === "CREATE_STANDALONE_SESSION" ? "AVULSO" : "CYCLE" } }));
  assert.deepEqual(operations.map((item) => item.type), types);
  assert.equal(new Set(operations.map((item) => item.operationId)).size, types.length);
});

test("fila mantém operações e sessão entre instâncias do serviço", async () => {
  const state = { operations: new Map(), sessions: new Map() };
  const storage = new MemoryOfflineSessionQueue(state);
  await startOfflineActiveSession({ userId: "user-1", studyGuideId: "guide-1", mode: "CYCLE", disciplineId: "discipline-1", subjectId: "subject-1", cycleEntryId: "entry-1", disciplineName: "Desenvolvimento", subjectName: "APIs", startedAt: base.startedAt }, storage);
  const consumerAfterRefresh = new MemoryOfflineSessionQueue(state);
  assert.equal((await consumerAfterRefresh.getOperations("user-1", "guide-1")).length, 1);
  assert.equal((await consumerAfterRefresh.getSession("user-1", "guide-1"))?.subjectId, "subject-1");
});

test("registro manual inicia pausado sem exigir cronômetro", async () => {
  const storage = new MemoryOfflineSessionQueue();
  const started = await startOfflineActiveSession({ userId: "user-1", studyGuideId: "guide-1", mode: "CYCLE", disciplineId: "discipline-1", subjectId: "subject-1", cycleEntryId: "entry-1", disciplineName: "Desenvolvimento", subjectName: "APIs", startedAt: base.startedAt, timerRunning: false }, storage);
  assert.equal(started.session.status, "PAUSED");
  assert.equal(started.session.pausedAt, null);
  assert.equal(started.session.accumulatedSeconds, 0);
});

test("operationId repetido sobrescreve sem duplicar a fila", async () => {
  const storage = new MemoryOfflineSessionQueue();
  const operation = createOfflineSessionOperation({ operationId: "fixed-operation", userId: "user-1", studyGuideId: "guide-1", type: "START_SESSION", payload: base });
  await storage.putOperation(operation); await storage.putOperation(operation);
  assert.equal((await storage.getOperations("user-1", "guide-1")).length, 1);
});

test("estudo avulso preserva disciplina, assunto e todos os resultados", async () => {
  const storage = new MemoryOfflineSessionQueue();
  const result = await createStandaloneOfflineSession({ userId: "user-1", studyGuideId: "guide-1", mode: "AVULSO", disciplineId: "discipline-1", subjectId: "subject-1", cycleEntryId: null, disciplineName: "Banco de Dados", subjectName: "SQL", startedAt: base.startedAt, pausedAt: null, finishedAt: "2026-07-25T10:20:00.000Z", accumulatedSeconds: 1200, questions: 15, correct: 12, wrong: 3, difficulty: "Média", notes: "Revisar joins", date: base.date }, storage);
  assert.equal(result.operation.type, "CREATE_STANDALONE_SESSION");
  assert.equal(result.session.localSessionId, `offline-${result.operation.operationId}`);
  assert.equal(result.operation.payload.subjectId, "subject-1");
  assert.equal(result.operation.payload.disciplineId, "discipline-1");
  assert.deepEqual([result.operation.payload.questions, result.operation.payload.correct, result.operation.payload.wrong], [15, 12, 3]);
});

test("revisão geral offline não exige matéria nem posição de ciclo", async () => {
  const storage = new MemoryOfflineSessionQueue();
  const result = await createStandaloneOfflineSession({
    userId: "user-1", studyGuideId: "guide-1", mode: "AVULSO", scope: "GENERAL",
    disciplineId: null, subjectId: null, cycleEntryId: null, disciplineName: "Todas as matérias", subjectName: "Revisão geral",
    startedAt: base.startedAt, pausedAt: null, finishedAt: "2026-07-25T11:00:00.000Z", accumulatedSeconds: 3600,
    questions: 30, correct: 24, wrong: 6, activityType: "REVIEW", advanceCycle: false,
    difficulty: "Média", notes: "Caderno misto", date: base.date,
  }, storage);
  assert.equal(result.operation.payload.scope, "GENERAL");
  assert.equal(result.operation.payload.cycleEntryId, null);
  assert.equal(result.operation.payload.subjectId, null);
  assert.deepEqual([result.operation.payload.questions, result.operation.payload.correct, result.operation.payload.wrong], [30, 24, 6]);
});

test("finalização offline não avança cursor local nem duplica a posição", async () => {
  const storage = new MemoryOfflineSessionQueue();
  const started = await startOfflineActiveSession({ userId: "user-1", studyGuideId: "guide-1", mode: "CYCLE", disciplineId: "discipline-1", subjectId: "subject-1", cycleEntryId: "entry-1", disciplineName: "Desenvolvimento", subjectName: "APIs", startedAt: base.startedAt }, storage);
  await queueOfflineSessionOperation({ userId: "user-1", studyGuideId: "guide-1", type: "FINISH_SESSION", session: { ...started.session, accumulatedSeconds: 1200, questions: 10, correct: 8, wrong: 2, difficulty: "Fácil" }, now: "2026-07-25T10:20:00.000Z" }, storage);
  const operations = await storage.getOperations("user-1", "guide-1");
  assert.deepEqual(operations.map((item) => item.type), ["START_SESSION", "FINISH_SESSION"]);
  assert.equal(operations[1].dependsOnOperationId, operations[0].operationId);
  assert.ok(operations.every((item) => item.payload.cycleEntryId === "entry-1"));
  assert.equal(Object.hasOwn(operations[1].payload, "currentOrderIndex"), false);
});

test("fila isola usuário e guia", async () => {
  const storage = new MemoryOfflineSessionQueue();
  for (const [userId, studyGuideId] of [["u1", "g1"], ["u1", "g2"], ["u2", "g1"]]) await storage.putOperation(createOfflineSessionOperation({ userId, studyGuideId, type: "START_SESSION", payload: base }));
  assert.equal((await storage.getOperations("u1", "g1")).length, 1);
});
