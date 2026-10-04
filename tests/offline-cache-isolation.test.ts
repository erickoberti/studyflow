import assert from "node:assert/strict";
import test from "node:test";
import {
  clearOfflineAccess,
  clearPendingOperations,
  deleteOfflineSession,
  getOfflineSnapshot,
  getOfflineSnapshotForEmail,
  markSessionSynced,
  mergeServerSnapshot,
  setOfflineAccess,
  setOfflineSnapshot,
  updateOfflineSession,
} from "../src/lib/offline/store";
import type { OfflineSnapshot } from "../src/lib/offline/types";
import { syncPendingOfflineSessions } from "../src/lib/offline/sync";

function snapshot(id: string, email: string, name = id): OfflineSnapshot {
  return {
    version: 2,
    user: { id, email, name },
    guides: [],
    activeGuideId: null,
    settings: null,
    disciplines: [],
    subjects: [],
    cycleEntries: [],
    sessions: [],
    pendingOperations: [],
    lastSyncedAt: null,
  };
}

test("cache offline permanece isolado entre contas, logout e nova sincronização", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;

  try {
    setOfflineAccess({ email: "a@example.com", userId: "user-a", name: "A", unlockedAt: "now" });
    setOfflineSnapshot(snapshot("user-a", "a@example.com"));
    assert.equal(getOfflineSnapshot().user?.id, "user-a");

    clearOfflineAccess();
    assert.equal(getOfflineSnapshot().user, null);

    setOfflineAccess({ email: "b@example.com", userId: "user-b", name: "B", unlockedAt: "now" });
    assert.equal(getOfflineSnapshot().user, null);
    assert.throws(() => mergeServerSnapshot(snapshot("user-a", "a@example.com")));
    setOfflineSnapshot(snapshot("user-b", "b@example.com"));
    assert.equal(getOfflineSnapshot().user?.id, "user-b");

    setOfflineAccess({ email: "a@example.com", userId: "user-a", name: "A", unlockedAt: "again" });
    assert.equal(getOfflineSnapshot().user?.id, "user-a");

    const pending = snapshot("user-a", "a@example.com");
    pending.pendingOperations = [{ id: "op-a", entity: "guide", action: "update", payload: {}, createdAt: "now" }, { id: "op-pending", entity: "guide", action: "update", payload: {}, createdAt: "later" }];
    setOfflineSnapshot(pending);
    const changed = snapshot("user-a", "a@example.com", "A atualizada");
    changed.guides = [{ id: "guide-new", serverId: "guide-new", name: "Novo", icon: "book", color: "#fff", description: null }];
    mergeServerSnapshot(changed);
    assert.equal(getOfflineSnapshot().user?.name, "A atualizada");
    assert.equal(getOfflineSnapshot().pendingOperations.length, 2);
    clearPendingOperations(["op-a"]);
    assert.deepEqual(getOfflineSnapshot().pendingOperations.map((operation) => operation.id), ["op-pending"]);
    clearPendingOperations(["op-pending"]);
    mergeServerSnapshot(changed);
    assert.equal(getOfflineSnapshot().guides[0]?.id, "guide-new");
    assert.equal(getOfflineSnapshotForEmail("b@example.com").user?.id, "user-b");
  } finally {
    globalThis.window = previousWindow;
  }
});

test("nova conta com o mesmo e-mail não recebe o snapshot da conta antiga", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;

  try {
    setOfflineAccess({ email: "same@example.com", userId: "old-id", name: "Antiga", unlockedAt: "now" });
    setOfflineSnapshot(snapshot("old-id", "same@example.com"));
    setOfflineAccess({ email: "same@example.com", userId: "new-id", name: "Nova", unlockedAt: "later" });
    assert.equal(getOfflineSnapshot().user, null);
    mergeServerSnapshot(snapshot("new-id", "same@example.com"));
    assert.equal(getOfflineSnapshot().user?.id, "new-id");
    assert.ok(values.has("studyflow-offline-snapshot:old-id"));
    assert.ok(values.has("studyflow-offline-snapshot:new-id"));
  } finally {
    globalThis.window = previousWindow;
  }
});

test("snapshot legado migra apenas para a conta correspondente", () => {
  const legacy = snapshot("user-a", "a@example.com");
  legacy.guides = [{ id: "guide", serverId: "guide", name: "Antigo", icon: "book", color: "#fff" } as OfflineSnapshot["guides"][number]];
  const values = new Map<string, string>([["studyflow-offline-snapshot", JSON.stringify(legacy)]]);
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;

  try {
    assert.equal(getOfflineSnapshotForEmail("b@example.com").user, null);
    assert.ok(values.has("studyflow-offline-snapshot"));
    assert.equal(getOfflineSnapshotForEmail("A@example.com").user?.id, "user-a");
    assert.equal(getOfflineSnapshotForEmail("A@example.com").guides[0].description, null);
    assert.equal(values.has("studyflow-offline-snapshot"), false);
    assert.ok(values.has("studyflow-offline-snapshot:user-a"));
  } finally {
    globalThis.window = previousWindow;
  }
});

test("resposta atrasada mantém assunto e data editados no snapshot local", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;
  try {
    setOfflineAccess({ email: "a@example.com", userId: "user-a", name: "A", unlockedAt: "now" });
    const local = snapshot("user-a", "a@example.com");
    local.sessions = [{ id: "local", serverId: null, cycleEntryId: "entry", subjectId: "subject-old", scope: "SUBJECT", date: "2026-09-28T15:00:00.000Z", questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 30, notes: null, createdAt: "2026-09-28T10:00:00.000Z", updatedAt: "2026-09-28T10:00:00.000Z", syncStatus: "pending_create", syncError: null }];
    setOfflineSnapshot(local);
    updateOfflineSession("local", { cycleEntryId: "entry", subjectId: "subject-new", scope: "SUBJECT", date: "2026-09-30", questions: 10, correct: 8, wrong: 2, estimatedMinutes: 30, notes: null });
    markSessionSynced("local", "server", local.sessions[0]);
    assert.equal(getOfflineSnapshot().sessions[0].syncStatus, "pending_update");
    const remote = snapshot("user-a", "a@example.com");
    remote.sessions = [{ ...local.sessions[0], id: "server", serverId: "server", subjectId: "subject-old", date: "2026-09-28T15:00:00.000Z", syncStatus: "synced" }];
    mergeServerSnapshot(remote);
    assert.equal(getOfflineSnapshot().sessions[0].subjectId, "subject-new");
    assert.equal(getOfflineSnapshot().sessions[0].date, "2026-09-30T15:00:00.000Z");
    assert.equal(getOfflineSnapshotForEmail("a@example.com").sessions[0].syncStatus, "pending_update");
    deleteOfflineSession("local");
    assert.equal(getOfflineSnapshot().sessions[0].syncStatus, "pending_delete");
    assert.equal(getOfflineSnapshot().sessions[0].serverId, "server");
  } finally {
    globalThis.window = previousWindow;
  }
});

test("sincronização iniciada em A não limpa pendências de B após troca de conta", async () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const previousCustomEvent = globalThis.CustomEvent;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;
  globalThis.CustomEvent = class<T> extends Event {
    detail: T;
    constructor(type: string, options: CustomEventInit<T>) { super(type); this.detail = options.detail as T; }
  } as unknown as typeof CustomEvent;

  let releaseResponse: (() => void) | undefined;
  const responseReady = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requestStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { requestStarted = resolve; });
  globalThis.fetch = (async () => {
    requestStarted?.();
    await responseReady;
    return Response.json({ ok: true });
  }) as typeof fetch;

  try {
    const accountA = snapshot("user-a", "a@example.com");
    accountA.pendingOperations = [{ id: "op-a", entity: "guide", action: "update", payload: {}, createdAt: "now" }];
    setOfflineAccess({ email: "a@example.com", userId: "user-a", name: "A", unlockedAt: "now" });
    setOfflineSnapshot(accountA);
    const syncing = syncPendingOfflineSessions();
    await started;

    const accountB = snapshot("user-b", "b@example.com");
    accountB.pendingOperations = [{ id: "op-b", entity: "guide", action: "update", payload: {}, createdAt: "now" }];
    setOfflineAccess({ email: "b@example.com", userId: "user-b", name: "B", unlockedAt: "now" });
    setOfflineSnapshot(accountB);
    releaseResponse?.();

    await assert.rejects(syncing, /conta mudou/);
    assert.equal(getOfflineSnapshot().pendingOperations[0]?.id, "op-b");
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    globalThis.CustomEvent = previousCustomEvent;
  }
});
