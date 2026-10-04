import assert from "node:assert/strict";
import test from "node:test";
import { createOfflineSessionOperation, MemoryOfflineSessionQueue, type OfflineSessionPayload } from "../src/lib/offline/active-session-queue";
import { synchronizeOfflineSessionQueue } from "../src/lib/offline/session-sync-engine";
import { canonicalSessionOperationPayload, completeOfflineOperation, hashOfflineOperation } from "../src/lib/offline-operation-ledger";
import type { Prisma } from "@prisma/client";

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

test("reinício recupera operação persistida como SYNCING com o mesmo ID", async () => {
  const state = { operations: new Map(), sessions: new Map() };
  const beforeRestart = new MemoryOfflineSessionQueue(state);
  await beforeRestart.putOperation({ ...operation("interrupted"), status: "SYNCING", attempts: 1, lastError: "Conexão interrompida" });
  const afterRestart = new MemoryOfflineSessionQueue(state);
  const received: string[] = [];
  const result = await synchronizeOfflineSessionQueue({ storage: afterRestart, userId: "user", studyGuideId: "guide", transport: async (item) => { received.push(item.operationId); return { status: 200, data: { sessionId: "saved" } }; } });
  assert.deepEqual(received, ["interrupted"]);
  assert.deepEqual(result.completed, ["interrupted"]);
  assert.equal((await afterRestart.getOperations("user", "guide"))[0].attempts, 2);
});

test("avulso reenviado após resposta perdida usa o mesmo ID e recebe confirmação anterior", async () => {
  const state = { operations: new Map(), sessions: new Map() };
  const storage = new MemoryOfflineSessionQueue(state);
  await storage.putOperation(createOfflineSessionOperation({ operationId: "standalone-stable", userId: "user", studyGuideId: "guide", type: "CREATE_STANDALONE_SESSION", payload: { ...payload, mode: "AVULSO", localSessionId: "offline-standalone-stable", serverSessionId: null, serverVersion: null } }));
  const received: string[] = [];
  const afterRestart = new MemoryOfflineSessionQueue(state);
  const result = await synchronizeOfflineSessionQueue({ storage: afterRestart, userId: "user", studyGuideId: "guide", transport: async (item) => { received.push(item.operationId); return { status: 200, data: { operationId: item.operationId, serverSessionId: "server-1", idempotentReplay: true } }; } });
  assert.deepEqual(received, ["standalone-stable"]);
  assert.deepEqual(result.completed, ["standalone-stable"]);
  assert.equal((await afterRestart.getOperations("user", "guide"))[0].status, "COMPLETED");
});

test("conflito persistente bloqueia apenas operações da mesma sessão após reinício", async () => {
  const state = { operations: new Map(), sessions: new Map() };
  const beforeRestart = new MemoryOfflineSessionQueue(state);
  await beforeRestart.putOperation({ ...operation("conflict", "PAUSE_SESSION"), status: "CONFLICT" });
  await beforeRestart.putOperation({ ...operation("dependent"), dependsOnOperationId: "conflict", createdAt: "2026-07-25T10:01:00.000Z" });
  await beforeRestart.putOperation({ ...operation("independent"), payload: { ...payload, localSessionId: "other-session" }, createdAt: "2026-07-25T10:02:00.000Z" });
  const received: string[] = [];
  const result = await synchronizeOfflineSessionQueue({ storage: new MemoryOfflineSessionQueue(state), userId: "user", studyGuideId: "guide", transport: async (item) => { received.push(item.operationId); return { status: 200, data: {} }; } });
  assert.deepEqual(received, ["independent"]);
  assert.deepEqual(result.blocked, ["dependent"]);
  assert.match((await beforeRestart.getOperations("user", "guide")).find((item) => item.operationId === "dependent")?.lastError ?? "", /Aguardando/);
});

test("falha definitiva não envia comandos dependentes", async () => {
  const storage = new MemoryOfflineSessionQueue();
  await storage.putOperation(operation("invalid-first", "PAUSE_SESSION"));
  await storage.putOperation({ ...operation("dependent-next"), dependsOnOperationId: "invalid-first", createdAt: "2026-07-25T10:01:00.000Z" });
  const received: string[] = [];
  const result = await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async (item) => { received.push(item.operationId); return { status: 422, data: { message: "inválida" } }; } });
  assert.deepEqual(received, ["invalid-first"]);
  assert.deepEqual(result.blocked, ["dependent-next"]);
});

test("troca de conta interrompe envio sem consumir a fila da primeira conta", async () => {
  const storage = new MemoryOfflineSessionQueue();
  await storage.putOperation(operation("account-a"));
  let currentAccount = "user";
  await assert.rejects(synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", assertAccount: () => { if (currentAccount !== "user") throw new Error("Conta mudou"); }, transport: async () => { currentAccount = "other"; return { status: 200, data: {} }; } }), /Conta mudou/);
  assert.equal((await storage.getOperations("user", "guide"))[0].status, "SYNCING");
  assert.equal((await storage.getOperations("other", "guide")).length, 0);
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

test("confirmação do avulso usa a mesma transação que criou o registro", async () => {
  const calls: unknown[] = [];
  const tx = { offlineOperation: { updateMany: async (args: unknown) => { calls.push(args); return { count: 1 }; } } } as unknown as Prisma.TransactionClient;
  await completeOfflineOperation("ledger-1", 2, { operationId: "op-1", serverSessionId: "session-1" }, tx);
  assert.equal(calls.length, 1);
  assert.deepEqual((calls[0] as { where: unknown }).where, { id: "ledger-1", version: 2, status: "SYNCING" });
  const failedTx = { offlineOperation: { updateMany: async () => ({ count: 0 }) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(completeOfflineOperation("ledger-1", 2, {}, failedTx), /alterado concorrentemente/);
});

test("operação inválida é cancelada e não entra em retry infinito", async () => {
  const storage = new MemoryOfflineSessionQueue(); await storage.putOperation(operation("invalid"));
  await synchronizeOfflineSessionQueue({ storage, userId: "user", studyGuideId: "guide", transport: async () => ({ status: 422, data: { message: "inválida" } }), wait: async () => undefined });
  assert.equal((await storage.getOperations("user", "guide"))[0].status, "CANCELLED");
});
