"use client";

import {
  clearPendingOperations,
  getOfflineSnapshot,
  hydrateOfflineSessionsFromServer,
  markSessionError,
  markSessionSynced,
  removeOfflineSession,
} from "@/lib/offline/store";
import { offlineSessionQueue, pruneCompletedOfflineOperations } from "@/lib/offline/active-session-queue";
import { synchronizeOfflineSessionQueue } from "@/lib/offline/session-sync-engine";
import { confirmedStructuralOperationIds } from "@/lib/offline/structural-sync-result";

let syncPromise: Promise<void> | null = null;
let syncPromiseUserId: string | null = null;
const SYNC_RUNTIME_EVENT = "studyflow-sync-runtime";
export type SyncRuntimeState = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";
let syncRuntimeState: SyncRuntimeState = "IDLE";

function setSyncRuntimeState(state: SyncRuntimeState) { syncRuntimeState = state; if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SYNC_RUNTIME_EVENT, { detail: state })); }
export function getSyncRuntimeState() { return syncRuntimeState; }
export function subscribeSyncRuntime(listener: (state: SyncRuntimeState) => void) { if (typeof window === "undefined") return () => undefined; const handler = (event: Event) => listener((event as CustomEvent<SyncRuntimeState>).detail); window.addEventListener(SYNC_RUNTIME_EVENT, handler); return () => window.removeEventListener(SYNC_RUNTIME_EVENT, handler); }

function ensureSameAccount(userId: string) {
  if (getOfflineSnapshot().user?.id !== userId) {
    throw new Error("A conta mudou durante a sincronização offline.");
  }
}

async function syncActiveSessionOperations(userId: string, studyGuideId: string) {
  const result = await synchronizeOfflineSessionQueue({ storage: offlineSessionQueue, userId, studyGuideId, assertAccount: () => ensureSameAccount(userId), transport: async (operation) => {
    const response = await fetch("/api/offline/session-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) });
    return { status: response.status, data: await response.json().catch(() => ({})) };
  } });
  ensureSameAccount(userId);
  await pruneCompletedOfflineOperations(offlineSessionQueue, userId, studyGuideId);
  return result;
}

export async function refreshOfflineSnapshotFromServer() {
  const response = await fetch("/api/offline/bootstrap", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível atualizar o cache offline.");
  }

  const payload = await response.json();
  hydrateOfflineSessionsFromServer(payload);
}

async function syncStructureOperations(userId: string) {
  ensureSameAccount(userId);
  const snapshot = getOfflineSnapshot();
  if (snapshot.pendingOperations.length === 0) return;

  const response = await fetch("/api/offline/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: snapshot.pendingOperations }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? "Falha ao sincronizar alterações estruturais.");
  }

  const result = await response.json().catch(() => null);
  ensureSameAccount(userId);
  const confirmedIds = confirmedStructuralOperationIds(snapshot.pendingOperations, result, userId);
  if (confirmedIds.length) clearPendingOperations(confirmedIds);
  if (confirmedIds.length !== snapshot.pendingOperations.length) throw new Error("Algumas alterações estruturais não foram confirmadas e continuam pendentes.");
  await refreshOfflineSnapshotFromServer();
}

async function syncSingleSession(session: ReturnType<typeof getOfflineSnapshot>["sessions"][number], snapshot: ReturnType<typeof getOfflineSnapshot>, userId: string) {
  ensureSameAccount(userId);
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

    ensureSameAccount(userId);
    removeOfflineSession(session.id);
    return;
  }

  if (session.scope === "GENERAL") {
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(session.date));
    const activeGuide = snapshot.guides.find((guide) => guide.id === snapshot.activeGuideId);
    const payload = session.serverId
      ? { scope: "GENERAL", id: session.serverId, date, questions: session.questions, correct: session.correct, wrong: session.wrong, estimatedMinutes: session.estimatedMinutes, notes: session.notes }
      : { scope: "GENERAL", studyGuideId: activeGuide?.serverId ?? activeGuide?.id, date, time: "12:00", correct: session.correct, wrong: session.wrong, estimatedMinutes: session.estimatedMinutes, difficulty: "Média", notes: session.notes };
    const response = await fetch("/api/study-sessions", { method: session.serverId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message ?? "Falha ao sincronizar revisão geral."); }
    const data = await response.json(); ensureSameAccount(userId); return markSessionSynced(session.id, data.id, session) !== "synced";
  }

  const legacyEntry = snapshot.cycleEntries.find((entry) => entry.id === session.cycleEntryId || entry.serverId === session.cycleEntryId);
  const legacySubject = snapshot.subjects.find((subject) => subject.id === session.subjectId || subject.serverId === session.subjectId)
    ?? (session.scope === "SUBJECT" ? null : legacyEntry ? snapshot.subjects.find((subject) => subject.id === legacyEntry.subjectId) : null);
  if (!legacySubject?.serverId) throw new Error("O registro offline legado não possui um assunto sincronizado e foi preservado neste dispositivo.");
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(session.date));
  if (session.scope === "SUBJECT" && !session.serverId) {
    const discipline = snapshot.disciplines.find((item) => item.id === legacySubject.disciplineId);
    const guide = snapshot.guides.find((item) => item.id === snapshot.activeGuideId);
    if (!discipline?.serverId || !guide?.serverId) throw new Error("O registro avulso aguarda sincronização da disciplina e do guia.");
    const response = await fetch("/api/study-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyGuideId: guide.serverId, disciplineId: discipline.serverId, subjectId: legacySubject.serverId, date: day, time: "12:00", correct: session.correct, wrong: session.wrong, estimatedMinutes: session.estimatedMinutes, activityType: session.activityType ?? "QUESTIONS", difficulty: "Média", notes: session.notes }),
    });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message ?? "Falha ao sincronizar estudo avulso."); }
    const data = await response.json(); ensureSameAccount(userId); return markSessionSynced(session.id, data.id, session) !== "synced";
  }
  const payload = {
    id: session.serverId ?? undefined,
    cycleEntryId: session.scope === "SUBJECT" ? null : session.cycleEntryId,
    subjectId: legacySubject.serverId,
    date: day,
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
  ensureSameAccount(userId);
  return markSessionSynced(session.id, data.id, session) !== "synced";
}

export async function syncPendingOfflineSessions(): Promise<void> {
  const userId = getOfflineSnapshot().user?.id;
  if (!userId) throw new Error("Entre em uma conta sincronizada antes de sincronizar dados offline.");
  if (syncPromise) {
    if (syncPromiseUserId === userId) return syncPromise;
    return syncPromise.catch(() => undefined).then(() => syncPendingOfflineSessions());
  }

  syncPromiseUserId = userId;
  let rerunForLocalEdit = false;

  syncPromise = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    setSyncRuntimeState("SYNCING");

    await syncStructureOperations(userId);

    ensureSameAccount(userId);
    const snapshot = getOfflineSnapshot();
    const activeResult = snapshot.user?.id && snapshot.activeGuideId ? await syncActiveSessionOperations(snapshot.user.id, snapshot.activeGuideId) : null;
    ensureSameAccount(userId);
    const pending = snapshot.sessions
      .filter((session) => session.syncStatus !== "synced")
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    let hasErrors = Boolean(activeResult && (activeResult.conflicts.length || activeResult.failed.length || activeResult.blocked.length));
    for (const session of pending) {
      try {
        rerunForLocalEdit = Boolean(await syncSingleSession(session, snapshot, userId)) || rerunForLocalEdit;
      } catch (error) {
        ensureSameAccount(userId);
        hasErrors = true;
        markSessionError(
          session.id,
          error instanceof Error ? error.message : "Não foi possível sincronizar agora.",
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
    syncPromiseUserId = null;
    if (rerunForLocalEdit && getOfflineSnapshot().user?.id === userId) {
      queueMicrotask(() => { syncPendingOfflineSessions().catch(() => undefined); });
    }
  });

  return syncPromise;
}
