import assert from "node:assert/strict";
import test from "node:test";
import { createOfflineSessionOperation, MemoryOfflineSessionQueue, type OfflineSessionPayload } from "../src/lib/offline/active-session-queue";
import { synchronizeOfflineSessionQueue } from "../src/lib/offline/session-sync-engine";
import { canonicalSessionOperationPayload, hashOfflineOperation } from "../src/lib/offline-operation-ledger";

const payload: OfflineSessionPayload = { localSessionId: "local-session", serverSessionId: "server-session", serverVersion: 1, mode: "CYCLE", disciplineId: "discipline", subjectId: "subject", cycleEntryId: "entry", disciplineName: "Desenvolvimento", subjectName: "APIs", startedAt: "2026-07-25T10:00:00.000Z", pausedAt: "2026-07-25T10:00:00.000Z", finishedAt: "2026-07-25T10:20:00.000Z", accumulatedSeconds: 1200, questions: 10, correct: 8, wrong: 2, difficulty: "Média", notes: "Revisar", date: "2026-07-25T10:00:00.000Z" };

function operation(operationId: string, type: "FINISH_SESSION" | "PAUSE_SESSION" = "FINISH_SESSION") { return createOfflineSessionOperation({ operationId, userId: "user", studyGuideId: "guide", type, payload }); }

test("reconexão envia operação pendente e a marca como concluída", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("reconnect"));
  const result = await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => ({ status: 200, data: { sessionId: "study-session" } }), wait: async () => undefined });
  assert.deepEqual(result.completed, ["reconnect"]); assert.equal((await storage.getOperations("user", "guide"))[0].status, "COMPLETED");
});

test("falha temporária executa retry com o mesmo operationId", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("retry")); const received: string[] = [];
  const result = await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async (item) => { received.push(item.operationId); return received.length === 1 ? { status: 503, data: { message: "temporário" } } : { status: 200, data: { sessionId: "ok" } }; }, wait: async () => undefined });
  assert.deepEqual(received, ["retry", "retry"]); assert.deepEqual(result.completed, ["retry"]);
});

test("operationId duplicado não é reenviado após confirmação", async () => {
  const storage = new MemoryOfflineSessionQueue(); const duplicate = operation("duplicate"); await storage.putOperation(duplicate); await storage.putOperation(duplicate); let calls = 0;
  await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => { calls += 1; return { status: 200, data: {} }; }, wait: async () => undefined });
  await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => { calls += 1; return { status: 200, data: {} }; }, wait: async () => undefined });
  assert.equal(calls, 1); assert.equal((await storage.getOperations("user", "guide")).length, 1);
});

test("versão antiga é preservada como conflito e bloqueia operações dependentes", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("stale", "PAUSE_SESSION")); await storage.putOperation(operation("dependent")); let calls = 0;
  const result = await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => { calls += 1; return { status: 409, data: { message: "Sessão alterada em outro dispositivo" } }; }, wait: async () => undefined });
  const items = await storage.getOperations("user", "guide"); assert.deepEqual(result.conflicts, ["stale"]); assert.equal(calls, 1); assert.equal(items[0].status, "CONFLICT"); assert.equal(items[1].status, "PENDING");
});

test("duas finalizações concorrentes produzem um efeito e um conflito", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("finish-a")); await storage.putOperation(operation("finish-b")); let effects = 0;
  const result = await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async (item) => { if (item.operationId === "finish-a") { effects += 1; return { status: 200, data: { sessionId: "only-session" } }; } return { status: 409, data: { message: "Sessão já finalizada com dados diferentes" } }; }, wait: async () => undefined });
  assert.equal(effects, 1); assert.deepEqual(result.completed, ["finish-a"]); assert.deepEqual(result.conflicts, ["finish-b"]);
});

test("resposta em processamento é repetida sem criar efeito duplicado", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("concurrent")); let calls = 0; let effects = 0;
  const result = await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => { calls += 1; if (calls === 1) return { status: 202, data: { pending: true } }; effects += 1; return { status: 200, data: { idempotentReplay: true } }; }, wait: async () => undefined });
  assert.equal(calls, 2); assert.equal(effects, 1); assert.deepEqual(result.completed, ["concurrent"]);
});

test("hash idempotente independe da ordem das propriedades e detecta payload diferente", () => {
  assert.equal(hashOfflineOperation({ b: 2, a: 1 }), hashOfflineOperation({ a: 1, b: 2 }));
  assert.notEqual(hashOfflineOperation({ a: 1 }), hashOfflineOperation({ a: 2 }));
});

test("payload canônico faz o retry online e offline representar a mesma finalização", () => {
  const online = canonicalSessionOperationPayload({ type: "FINISH_SESSION", sessionId: "server-session", version: 1, questions: 10, correct: 8, minutes: 20, notes: "[Média] Revisar" });
  const offline = canonicalSessionOperationPayload({ type: "FINISH_SESSION", sessionId: payload.serverSessionId, version: payload.serverVersion, questions: payload.questions, correct: payload.correct, minutes: payload.accumulatedSeconds / 60, notes: `[${payload.difficulty}] ${payload.notes}` });
  assert.deepEqual(online, offline);
});

test("payload idempotente do estudo avulso inclui a data histórica", () => {
  const first = canonicalSessionOperationPayload({ type: "CREATE_STANDALONE_SESSION", disciplineId: "discipline", subjectId: "subject", questions: 10, correct: 8, minutes: 20, date: "2026-07-20T13:30:00.000Z" });
  const otherDate = canonicalSessionOperationPayload({ type: "CREATE_STANDALONE_SESSION", disciplineId: "discipline", subjectId: "subject", questions: 10, correct: 8, minutes: 20, date: "2026-07-21T13:30:00.000Z" });
  assert.notEqual(hashOfflineOperation(first), hashOfflineOperation(otherDate));
});

test("operação inválida é cancelada e não entra em retry infinito", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("invalid"));
  await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => ({ status: 422, data: { message: "inválida" } }), wait: async () => undefined });
  assert.equal((await storage.getOperations("user", "guide"))[0].status, "CANCELLED");
});
