"use client";

import {
  clearPendingOperations,
  getOfflineSnapshot,
  hydrateOfflineSessionsFromServer,
  markSessionError,
  markSessionSynced,
  removeOfflineSession,
} from "@/lib/offline/store";

let syncPromise: Promise<void> | null = null;

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

async function syncSingleSession(session: ReturnType<typeof getOfflineSnapshot>["sessions"][number]) {
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

  const payload = {
    id: session.serverId ?? undefined,
    cycleEntryId: session.cycleEntryId,
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
    const pending = snapshot.sessions
      .filter((session) => session.syncStatus !== "synced")
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    for (const session of pending) {
      try {
        await syncSingleSession(session);
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
