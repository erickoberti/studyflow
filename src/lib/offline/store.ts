"use client";

import type {
  OfflineAccessSession,
  OfflineCycleEntry,
  OfflineDiscipline,
  OfflinePendingOperation,
  OfflineSnapshot,
  OfflineStudySession,
  OfflineSubject,
} from "@/lib/offline/types";

const SNAPSHOT_KEY = "studyflow-offline-snapshot";
const ACCESS_KEY = "studyflow-offline-access";
const CHANGE_EVENT = "studyflow-offline-change";
const SNAPSHOT_VERSION = 2;

function fallbackSnapshot(): OfflineSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    user: null,
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

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function sortSessions(sessions: OfflineStudySession[]) {
  return [...sessions].sort((a, b) => {
    const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (byDate !== 0) return byDate;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function sortCycleEntries(cycleEntries: OfflineCycleEntry[]) {
  return [...cycleEntries].sort((a, b) => a.orderIndex - b.orderIndex);
}

function setSnapshot(snapshot: OfflineSnapshot) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({
      ...snapshot,
      version: SNAPSHOT_VERSION,
    }),
  );
  emitChange();
}

function nextOperation(entity: OfflinePendingOperation["entity"], action: OfflinePendingOperation["action"], payload: Record<string, unknown>): OfflinePendingOperation {
  return {
    id: crypto.randomUUID(),
    entity,
    action,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function withOperation(snapshot: OfflineSnapshot, operation: OfflinePendingOperation) {
  return {
    ...snapshot,
    pendingOperations: [...snapshot.pendingOperations, operation],
  };
}

function replaceSnapshot(snapshot: OfflineSnapshot) {
  setSnapshot({
    ...snapshot,
    guides: Array.isArray(snapshot.guides) ? snapshot.guides : [],
    disciplines: Array.isArray(snapshot.disciplines) ? snapshot.disciplines : [],
    subjects: Array.isArray(snapshot.subjects) ? snapshot.subjects : [],
    cycleEntries: Array.isArray(snapshot.cycleEntries) ? sortCycleEntries(snapshot.cycleEntries) : [],
    sessions: Array.isArray(snapshot.sessions) ? sortSessions(snapshot.sessions) : [],
    pendingOperations: Array.isArray(snapshot.pendingOperations) ? snapshot.pendingOperations : [],
  });
}

function upsertCycleEntry(snapshot: OfflineSnapshot, input: { guideId: string; subjectId: string; orderIndex: number }) {
  const existing = snapshot.cycleEntries.find((entry) => entry.subjectId === input.subjectId && entry.guideId === input.guideId);
  if (existing) {
    return {
      ...snapshot,
      cycleEntries: sortCycleEntries(
        snapshot.cycleEntries.map((entry) =>
          entry.id === existing.id
            ? {
                ...entry,
                orderIndex: input.orderIndex,
                active: true,
              }
            : entry,
        ),
      ),
    };
  }

  return {
    ...snapshot,
    cycleEntries: sortCycleEntries([
      ...snapshot.cycleEntries,
      {
        id: crypto.randomUUID(),
        serverId: null,
        guideId: input.guideId,
        subjectId: input.subjectId,
        orderIndex: input.orderIndex,
        active: true,
      },
    ]),
  };
}

function removeCycleEntryBySubject(snapshot: OfflineSnapshot, subjectId: string) {
  return {
    ...snapshot,
    cycleEntries: snapshot.cycleEntries.filter((entry) => entry.subjectId !== subjectId),
  };
}

export function subscribeOfflineStore(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function getOfflineSnapshot() {
  if (!canUseStorage()) return fallbackSnapshot();

  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return fallbackSnapshot();
    const parsed = JSON.parse(raw) as Partial<OfflineSnapshot>;
    return {
      ...fallbackSnapshot(),
      ...parsed,
      guides: Array.isArray(parsed.guides) ? parsed.guides : [],
      disciplines: Array.isArray(parsed.disciplines) ? parsed.disciplines : [],
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      cycleEntries: Array.isArray(parsed.cycleEntries) ? sortCycleEntries(parsed.cycleEntries) : [],
      sessions: Array.isArray(parsed.sessions) ? sortSessions(parsed.sessions) : [],
      pendingOperations: Array.isArray(parsed.pendingOperations) ? parsed.pendingOperations : [],
    };
  } catch {
    return fallbackSnapshot();
  }
}

export function setOfflineSnapshot(snapshot: OfflineSnapshot) {
  replaceSnapshot(snapshot);
}

export function getOfflineAccess() {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(ACCESS_KEY);
    return raw ? (JSON.parse(raw) as OfflineAccessSession) : null;
  } catch {
    return null;
  }
}

export function setOfflineAccess(access: OfflineAccessSession) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  emitChange();
}

export function clearOfflineAccess() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  emitChange();
}

export function mergeServerSnapshot(serverSnapshot: OfflineSnapshot) {
  const local = getOfflineSnapshot();
  const pendingByServerId = new Map(
    local.sessions
      .filter((session) => session.serverId && session.syncStatus !== "synced")
      .map((session) => [session.serverId as string, session]),
  );
  const pendingLocalOnly = local.sessions.filter((session) => !session.serverId && session.syncStatus !== "synced");

  const mergedSessions = serverSnapshot.sessions.map((session) => {
    const localPending = pendingByServerId.get(session.serverId ?? "");
    return localPending ?? session;
  });

  replaceSnapshot({
    ...serverSnapshot,
    guides: local.pendingOperations.length > 0 ? local.guides : serverSnapshot.guides,
    activeGuideId: local.pendingOperations.length > 0 ? local.activeGuideId : serverSnapshot.activeGuideId,
    settings: local.pendingOperations.length > 0 ? local.settings : serverSnapshot.settings,
    disciplines: local.pendingOperations.length > 0 ? local.disciplines : serverSnapshot.disciplines,
    subjects: local.pendingOperations.length > 0 ? local.subjects : serverSnapshot.subjects,
    cycleEntries: local.pendingOperations.length > 0 ? local.cycleEntries : serverSnapshot.cycleEntries,
    pendingOperations: local.pendingOperations,
    sessions: sortSessions([...mergedSessions, ...pendingLocalOnly]),
  });
}

export function createOfflineSession(input: {
  cycleEntryId: string;
  date: string;
  questions: number;
  correct: number;
  wrong: number;
  estimatedMinutes: number;
  activityType?: "QUESTIONS" | "CLASS" | "READING" | "PDF_READING" | "REVIEW";
  notes: string | null;
}) {
  const snapshot = getOfflineSnapshot();
  const now = new Date().toISOString();
  const session: OfflineStudySession = {
    id: crypto.randomUUID(),
    serverId: null,
    cycleEntryId: input.cycleEntryId,
    date: new Date(`${input.date}T12:00:00-03:00`).toISOString(),
    questions: input.questions,
    correct: input.correct,
    wrong: input.wrong,
    percentage: input.questions > 0 ? (input.correct / input.questions) * 100 : 0,
    estimatedMinutes: input.estimatedMinutes,
    activityType: input.activityType ?? "QUESTIONS",
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending_create",
    syncError: null,
  };

  replaceSnapshot({
    ...snapshot,
    sessions: sortSessions([session, ...snapshot.sessions]),
  });

  return session;
}

export function updateOfflineSession(
  sessionId: string,
  input: {
    cycleEntryId: string | null;
    scope?: "CYCLE" | "SUBJECT" | "GENERAL";
    date: string;
    questions: number;
    correct: number;
    wrong: number;
    estimatedMinutes: number;
    activityType?: "QUESTIONS" | "CLASS" | "READING" | "PDF_READING" | "REVIEW";
    notes: string | null;
  },
) {
  const snapshot = getOfflineSnapshot();
  const updatedAt = new Date().toISOString();
  const sessions: OfflineStudySession[] = snapshot.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      cycleEntryId: input.cycleEntryId,
      scope: input.scope ?? session.scope,
      date: new Date(`${input.date}T12:00:00-03:00`).toISOString(),
      questions: input.questions,
      correct: input.correct,
      wrong: input.wrong,
      percentage: input.questions > 0 ? (input.correct / input.questions) * 100 : 0,
      estimatedMinutes: input.estimatedMinutes,
      activityType: input.activityType ?? session.activityType ?? "QUESTIONS",
      notes: input.notes,
      updatedAt,
      syncStatus: session.serverId ? ("pending_update" as const) : ("pending_create" as const),
      syncError: null,
    };
  });

  replaceSnapshot({
    ...snapshot,
    sessions,
  });
}

export function deleteOfflineSession(sessionId: string) {
  const snapshot = getOfflineSnapshot();
  const target = snapshot.sessions.find((session) => session.id === sessionId);
  if (!target) return;

  if (!target.serverId) {
    replaceSnapshot({
      ...snapshot,
      sessions: snapshot.sessions.filter((session) => session.id !== sessionId),
    });
    return;
  }

  const updatedAt = new Date().toISOString();
  replaceSnapshot({
    ...snapshot,
    sessions: sortSessions(
      snapshot.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              syncStatus: "pending_delete",
              syncError: null,
              updatedAt,
            }
          : session,
      ),
    ),
  });
}

export function hydrateOfflineSessionsFromServer(input: {
  user: OfflineSnapshot["user"];
  guides: OfflineSnapshot["guides"];
  activeGuideId: string | null;
  settings: OfflineSnapshot["settings"];
  disciplines: OfflineSnapshot["disciplines"];
  subjects: OfflineSnapshot["subjects"];
  cycleEntries: OfflineCycleEntry[];
  sessions: Array<{
    id: string;
    cycleEntryId: string | null;
    scope?: "CYCLE" | "SUBJECT" | "GENERAL";
    date: string;
    questions: number;
    correct: number;
    wrong: number;
    percentage: number;
    estimatedMinutes: number;
    activityType?: "QUESTIONS" | "CLASS" | "READING" | "PDF_READING" | "REVIEW";
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}) {
  const serverSnapshot: OfflineSnapshot = {
    version: SNAPSHOT_VERSION,
    user: input.user,
    guides: input.guides,
    activeGuideId: input.activeGuideId,
    settings: input.settings,
    disciplines: input.disciplines,
    subjects: input.subjects,
    cycleEntries: input.cycleEntries,
    sessions: input.sessions.map((session) => ({
      ...session,
      serverId: session.id,
      syncStatus: "synced",
      syncError: null,
    })),
    pendingOperations: [],
    lastSyncedAt: new Date().toISOString(),
  };

  mergeServerSnapshot(serverSnapshot);
}

export function markSessionSynced(localId: string, serverId: string) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot({
    ...snapshot,
    lastSyncedAt: new Date().toISOString(),
    sessions: sortSessions(
      snapshot.sessions.map((session) =>
        session.id === localId
          ? {
              ...session,
              serverId,
              syncStatus: "synced",
              syncError: null,
            }
          : session,
      ),
    ),
  });
}

export function removeOfflineSession(localId: string) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot({
    ...snapshot,
    lastSyncedAt: new Date().toISOString(),
    sessions: snapshot.sessions.filter((session) => session.id !== localId),
  });
}

export function markSessionError(localId: string, message: string) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot({
    ...snapshot,
    sessions: sortSessions(
      snapshot.sessions.map((session) =>
        session.id === localId
          ? {
              ...session,
              syncStatus: "error",
              syncError: message,
            }
          : session,
      ),
    ),
  });
}

export function clearPendingOperations() {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot({
    ...snapshot,
    pendingOperations: [],
  });
}

export function createOfflineGuide(input: { name: string; icon: string; color: string; description: string | null }) {
  const snapshot = getOfflineSnapshot();
  const guideId = crypto.randomUUID();
  const guide = {
    id: guideId,
    serverId: null,
    name: input.name,
    icon: input.icon,
    color: input.color,
    description: input.description,
  };

  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        guides: [...snapshot.guides, guide],
        activeGuideId: guideId,
      },
      nextOperation("guide", "create", {
        clientId: guideId,
        ...input,
      }),
    ),
  );
}

export function updateOfflineGuide(guideId: string, input: { name: string; icon: string; color: string; description: string | null }) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        guides: snapshot.guides.map((guide) =>
          guide.id === guideId
            ? {
                ...guide,
                ...input,
              }
            : guide,
        ),
      },
      nextOperation("guide", "update", { id: guideId, ...input }),
    ),
  );
}

export function selectOfflineGuide(guideId: string) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        activeGuideId: guideId,
      },
      nextOperation("guide-selection", "select", { id: guideId }),
    ),
  );
}

export function deleteOfflineGuide(guideId: string) {
  const snapshot = getOfflineSnapshot();
  const nextGuides = snapshot.guides.filter((guide) => guide.id !== guideId);
  const nextActiveGuideId = snapshot.activeGuideId === guideId ? nextGuides[0]?.id ?? null : snapshot.activeGuideId;
  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        guides: nextGuides,
        activeGuideId: nextActiveGuideId,
        disciplines: snapshot.disciplines.filter((discipline) => discipline.guideId !== guideId),
        subjects: snapshot.subjects.filter((subject) => subject.guideId !== guideId),
        cycleEntries: snapshot.cycleEntries.filter((entry) => entry.guideId !== guideId),
      },
      nextOperation("guide", "delete", { id: guideId }),
    ),
  );
}

export function createOfflineDiscipline(input: {
  guideId: string;
  name: string;
  category: string | null;
  sortOrder: number | null;
}) {
  const snapshot = getOfflineSnapshot();
  const disciplineId = crypto.randomUUID();
  const discipline: OfflineDiscipline = {
    id: disciplineId,
    serverId: null,
    guideId: input.guideId,
    name: input.name,
    category: input.category,
    sortOrder: input.sortOrder,
    active: true,
  };

  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        disciplines: [...snapshot.disciplines, discipline],
      },
      nextOperation("discipline", "create", {
        clientId: disciplineId,
        ...input,
      }),
    ),
  );
}

export function updateOfflineDiscipline(
  disciplineId: string,
  input: { name: string; category: string | null; sortOrder: number | null; active: boolean },
) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        disciplines: snapshot.disciplines.map((discipline) =>
          discipline.id === disciplineId
            ? {
                ...discipline,
                ...input,
              }
            : discipline,
        ),
      },
      nextOperation("discipline", "update", { id: disciplineId, ...input }),
    ),
  );
}

export function deleteOfflineDiscipline(disciplineId: string) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        disciplines: snapshot.disciplines.filter((discipline) => discipline.id !== disciplineId),
        subjects: snapshot.subjects.filter((subject) => subject.disciplineId !== disciplineId),
        cycleEntries: snapshot.cycleEntries.filter((entry) => {
          const subject = snapshot.subjects.find((item) => item.id === entry.subjectId);
          return subject?.disciplineId !== disciplineId;
        }),
      },
      nextOperation("discipline", "delete", { id: disciplineId }),
    ),
  );
}

export function createOfflineSubject(input: {
  guideId: string;
  disciplineId: string;
  name: string;
  weight: number;
  notes: string | null;
  tecReference: string | null;
  orderIndex: number | null;
}) {
  const snapshot = getOfflineSnapshot();
  const subjectId = crypto.randomUUID();
  const subject: OfflineSubject = {
    id: subjectId,
    serverId: null,
    guideId: input.guideId,
    disciplineId: input.disciplineId,
    name: input.name,
    weight: input.weight,
    notes: input.notes,
    tecReference: input.tecReference,
    active: true,
    orderIndex: input.orderIndex,
  };

  const baseSnapshot = {
    ...snapshot,
    subjects: [...snapshot.subjects, subject],
  };
  const withCycle = input.orderIndex ? upsertCycleEntry(baseSnapshot, { guideId: input.guideId, subjectId, orderIndex: input.orderIndex }) : baseSnapshot;

  replaceSnapshot(
    withOperation(
      withCycle,
      nextOperation("subject", "create", {
        clientId: subjectId,
        ...input,
      }),
    ),
  );
}

export function updateOfflineSubject(
  subjectId: string,
  input: {
    disciplineId: string;
    name: string;
    weight: number;
    notes: string | null;
    tecReference: string | null;
    active: boolean;
    orderIndex: number | null;
  },
) {
  const snapshot = getOfflineSnapshot();
  const current = snapshot.subjects.find((subject) => subject.id === subjectId);
  if (!current) return;

  let nextSnapshot: OfflineSnapshot = {
    ...snapshot,
    subjects: snapshot.subjects.map((subject) =>
      subject.id === subjectId
        ? {
            ...subject,
            ...input,
          }
        : subject,
    ),
  };

  nextSnapshot = input.orderIndex
    ? upsertCycleEntry(nextSnapshot, { guideId: current.guideId, subjectId, orderIndex: input.orderIndex })
    : removeCycleEntryBySubject(nextSnapshot, subjectId);

  replaceSnapshot(
    withOperation(
      nextSnapshot,
      nextOperation("subject", "update", { id: subjectId, ...input }),
    ),
  );
}

export function updateOfflineSettings(input: {
  guideId: string;
  targetPercentage: number;
  dailyQuestionsGoal: number;
  weeklyQuestionsGoal: number;
  weightPriorityBias: number;
}) {
  const snapshot = getOfflineSnapshot();
  replaceSnapshot(
    withOperation(
      {
        ...snapshot,
        settings: {
          targetPercentage: input.targetPercentage,
          dailyQuestionsGoal: input.dailyQuestionsGoal,
          weeklyQuestionsGoal: input.weeklyQuestionsGoal,
          weightPriorityBias: input.weightPriorityBias,
        },
      },
      nextOperation("settings", "upsert", input),
    ),
  );
}
