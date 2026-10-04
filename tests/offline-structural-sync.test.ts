import assert from "node:assert/strict";
import test from "node:test";
import { confirmedStructuralOperationIds } from "../src/lib/offline/structural-sync-result";
import type { OfflinePendingOperation } from "../src/lib/offline/types";

const operations: OfflinePendingOperation[] = ["one", "two", "three", "four", "five"].map((id) => ({ id, entity: "guide", action: "update", payload: {}, createdAt: "2026-10-02T12:00:00.000Z" }));

test("lote confirma apenas operações concluídas ou já processadas", () => {
  const confirmed = confirmedStructuralOperationIds(operations, { userId: "account-a", results: [
    { id: "one", status: "completed" },
    { id: "two", status: "already_processed" },
    { id: "three", status: "rejected" },
    { id: "four", status: "blocked" },
  ] }, "account-a");
  assert.deepEqual(confirmed, ["one", "two"]);
  assert.deepEqual(operations.filter((operation) => !confirmed.includes(operation.id)).map((operation) => operation.id), ["three", "four", "five"]);
});

test("resposta de outra conta, ausente ou ambígua não confirma a fila", () => {
  assert.deepEqual(confirmedStructuralOperationIds(operations, { userId: "account-b", results: [{ id: "one", status: "completed" }] }, "account-a"), []);
  assert.deepEqual(confirmedStructuralOperationIds(operations, { userId: "account-a", results: [{ id: "unknown", status: "completed" }] }, "account-a"), []);
  assert.deepEqual(confirmedStructuralOperationIds(operations, { userId: "account-a", results: [{ id: "one", status: "completed" }, { id: "one", status: "rejected" }] }, "account-a"), []);
  assert.deepEqual(confirmedStructuralOperationIds(operations, { ok: true }, "account-a"), []);
});

test("resultado ausente da criação impede confirmar dependente, sem bloquear outro guia", () => {
  const dependent: OfflinePendingOperation[] = [
    { id: "create-guide", entity: "guide", action: "create", payload: { clientId: "local-guide" }, createdAt: "2026-10-02T12:00:00.000Z" },
    { id: "create-discipline", entity: "discipline", action: "create", payload: { clientId: "local-discipline", guideId: "local-guide" }, createdAt: "2026-10-02T12:01:00.000Z" },
    { id: "other-guide", entity: "guide", action: "update", payload: { id: "other" }, createdAt: "2026-10-02T12:02:00.000Z" },
  ];
  const result = confirmedStructuralOperationIds(dependent, { userId: "account-a", results: [
    { id: "create-discipline", status: "completed" }, { id: "other-guide", status: "completed" },
  ] }, "account-a");
  assert.deepEqual(result, ["other-guide"]);
});

test("criação exige mapeamento do ID local ao ID confirmado pelo servidor", () => {
  const created: OfflinePendingOperation[] = [{ id: "create", entity: "guide", action: "create", payload: { clientId: "local-guide" }, createdAt: "2026-10-02T12:00:00.000Z" }];
  assert.deepEqual(confirmedStructuralOperationIds(created, { userId: "account-a", results: [{ id: "create", status: "completed" }] }, "account-a"), []);
  assert.deepEqual(confirmedStructuralOperationIds(created, { userId: "account-a", results: [{ id: "create", status: "already_processed", serverId: "other-id" }] }, "account-a"), []);
  assert.deepEqual(confirmedStructuralOperationIds(created, { userId: "account-a", results: [{ id: "create", status: "already_processed", serverId: "local-guide" }] }, "account-a"), ["create"]);
});
