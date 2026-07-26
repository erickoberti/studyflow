"use client";

import {
  clearPendingOperations,
  getOfflineSnapshot,
  hydrateOfflineSessionsFromServer,
  markSessionError,
  markSessionSynced,
  removeOfflineSession,
} from "@/lib/offline/store";
import { offlineSessionQueue, type OfflineSessionOperation } from "@/lib/offline/active-session-queue";

let syncPromise: Promise<void> | null = null;

async function syncActiveSessionOperations(userId: string, studyGuideId: string) {
  const operations = (await offlineSessionQueue.getOperations(userId, studyGuideId))
    .filter((operation) => operation.status === "PENDING" || operation.status === "FAILED")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const queuedOperation of operations) {
    const operation = (await offlineSessionQueue.getOperations(userId, studyGuideId)).find((item) => item.operationId === queuedOperation.operationId) ?? queuedOperation;
    await offlineSessionQueue.updateOperation(operation.operationId, { status: "SYNCING", attempts: operation.attempts + 1, lastError: null });
    try {
      const response = await fetch("/api/offline/session-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status: OfflineSessionOperation["status"] = response.status === 409 ? "CONFLICT" : "FAILED";
        await offlineSessionQueue.updateOperation(operation.operationId, { status, lastError: data.message ?? "Falha ao sincronizar a sessão." });
        if (status === "CONFLICT") break;
        continue;
      }
      const serverSessionId = data.session?.id ?? data.serverSessionId;
      const serverVersion = data.session?.version ?? data.version;
      if (serverSessionId) await offlineSessionQueue.updateOperationsForSession(operation.payload.localSessionId, { serverSessionId, serverVersion: typeof serverVersion === "number" ? serverVersion : operation.payload.serverVersion });
      await offlineSessionQueue.updateOperation(operation.operationId, { status: "COMPLETED", syncedAt: new Date().toISOString(), lastError: null });
      const local = await offlineSessionQueue.getSession(userId, studyGuideId);
      if (local?.localSessionId === operation.payload.localSessionId) {
        const remaining = (await offlineSessionQueue.getOperations(userId, studyGuideId)).some((item) => item.operationId !== operation.operationId && item.payload.localSessionId === operation.payload.localSessionId && ["PENDING", "SYNCING", "FAILED", "CONFLICT"].includes(item.status));
        await offlineSessionQueue.putSession({ ...local, serverSessionId: serverSessionId ?? local.serverSessionId, serverVersion: typeof serverVersion === "number" ? serverVersion : local.serverVersion, pendingSync: remaining, updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      await offlineSessionQueue.updateOperation(operation.operationId, { status: "FAILED", lastError: error instanceof Error ? error.message : "Falha de conexão." });
      break;
    }
  }
}

export async function refreshOfflineSnapshotFromServer() {
  const response = await fetch("/api/offline/bootstrap", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel atualizar o cache offline.");
  }

  const payload = await response.json();
  hydrateOfflineSessionsFromServer(payload);
}

async function syncStructureOperations() {
  const snapshot = getOfflineSnapshot();
  if (snapshot.pendingOperations.length === 0) return;

  const response = await fetch("/api/offline/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: snapshot.pendingOperations }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? "Falha ao sincronizar alteracoes estruturais.");
  }

  clearPendingOperations();
  await refreshOfflineSnapshotFromServer();
}

async function syncSingleSession(session: ReturnType<typeof getOfflineSnapshot>["sessions"][number], snapshot: ReturnType<typeof getOfflineSnapshot>) {
  if (session.syncStatus === "pending_delete") {
    if (!session.serverId) {
      removeOfflineSession(session.id);
      return;
    }

    const response = await fetch("/api/study-sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: session.serverId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message ?? "Falha ao excluir registro no servidor.");
    }

    removeOfflineSession(session.id);
    return;
  }

  const legacyEntry = snapshot.cycleEntries.find((entry) => entry.id === session.cycleEntryId || entry.serverId === session.cycleEntryId);
  const legacySubject = legacyEntry ? snapshot.subjects.find((subject) => subject.id === legacyEntry.subjectId) : null;
  if (!legacySubject?.serverId) throw new Error("O registro offline legado não possui um assunto sincronizado e foi preservado neste dispositivo.");
  const payload = {
    id: session.serverId ?? undefined,
    cycleEntryId: session.cycleEntryId,
    subjectId: legacySubject.serverId,
    date: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(session.date)),
    questions: session.questions,
    correct: session.correct,
    wrong: session.wrong,
    estimatedMinutes: session.estimatedMinutes,
    notes: session.notes,
  };

  const response = await fetch("/api/study-sessions", {
    method: session.serverId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? "Falha ao sincronizar registro.");
  }

  const data = await response.json();
  markSessionSynced(session.id, data.id);
}

export async function syncPendingOfflineSessions() {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    await syncStructureOperations();

    const snapshot = getOfflineSnapshot();
    if (snapshot.user?.id && snapshot.activeGuideId) await syncActiveSessionOperations(snapshot.user.id, snapshot.activeGuideId);
    const pending = snapshot.sessions
      .filter((session) => session.syncStatus !== "synced")
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    for (const session of pending) {
      try {
        await syncSingleSession(session, snapshot);
      } catch (error) {
        markSessionError(
          session.id,
          error instanceof Error ? error.message : "Nao foi possivel sincronizar agora.",
        );
      }
    }

    await refreshOfflineSnapshotFromServer();
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
