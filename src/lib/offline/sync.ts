"use client";

import {
  clearPendingOperations,
  getOfflineSnapshot,
  hydrateOfflineSessionsFromServer,
  markSessionError,
  markSessionSynced,
  removeOfflineSession,
} from "@/lib/offline/store";
import { offlineSessionQueue } from "@/lib/offline/active-session-queue";
import { synchronizeOfflineSessionQueue } from "@/lib/offline/session-sync-engine";

let syncPromise: Promise<void> | null = null;
const SYNC_RUNTIME_EVENT = "studyflow-sync-runtime";
export type SyncRuntimeState = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";
let syncRuntimeState: SyncRuntimeState = "IDLE";

function setSyncRuntimeState(state: SyncRuntimeState) { syncRuntimeState = state; if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SYNC_RUNTIME_EVENT, { detail: state })); }
export function getSyncRuntimeState() { return syncRuntimeState; }
export function subscribeSyncRuntime(listener: (state: SyncRuntimeState) => void) { if (typeof window === "undefined") return () => undefined; const handler = (event: Event) => listener((event as CustomEvent<SyncRuntimeState>).detail); window.addEventListener(SYNC_RUNTIME_EVENT, handler); return () => window.removeEventListener(SYNC_RUNTIME_EVENT, handler); }

async function syncActiveSessionOperations(userId: string, studyGuideId: string) {
  await synchronizeOfflineSessionQueue({ storage: offlineSessionQueue, userId, studyGuideId, transport: async (operation) => {
    const response = await fetch("/api/offline/session-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) });
    return { status: response.status, data: await response.json().catch(() => ({})) };
  } });
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
    activityType: session.activityType ?? "QUESTIONS",
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

    setSyncRuntimeState("SYNCING");

    await syncStructureOperations();

    const snapshot = getOfflineSnapshot();
    if (snapshot.user?.id && snapshot.activeGuideId) await syncActiveSessionOperations(snapshot.user.id, snapshot.activeGuideId);
    const pending = snapshot.sessions
      .filter((session) => session.syncStatus !== "synced")
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    let hasErrors = false;
    for (const session of pending) {
      try {
        await syncSingleSession(session, snapshot);
      } catch (error) {
        hasErrors = true;
        markSessionError(
          session.id,
          error instanceof Error ? error.message : "Nao foi possivel sincronizar agora.",
        );
      }
    }

    await refreshOfflineSnapshotFromServer();
    setSyncRuntimeState(hasErrors ? "ERROR" : "SUCCESS");
  })().catch((error) => {
    setSyncRuntimeState("ERROR");
    throw error;
  }).finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
