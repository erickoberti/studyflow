"use client";

export const OFFLINE_SESSION_SCHEMA_VERSION = 1;
export const OFFLINE_SESSION_DB_NAME = "studyflow-active-sessions";
const OFFLINE_SESSION_CHANGE_EVENT = "studyflow-offline-session-change";

export type OfflineSessionOperationType =
  | "START_SESSION"
  | "PAUSE_SESSION"
  | "RESUME_SESSION"
  | "FINISH_SESSION"
  | "CANCEL_SESSION"
  | "CREATE_STANDALONE_SESSION";

export type OfflineSessionOperationStatus =
  | "PENDING"
  | "SYNCING"
  | "COMPLETED"
  | "FAILED"
  | "CONFLICT"
  | "CANCELLED";

export type OfflineStudyMode = "CYCLE" | "AVULSO";
export type OfflineDifficulty = "Fácil" | "Média" | "Difícil" | null;
export type OfflineActivityType = "QUESTIONS" | "CLASS" | "READING" | "PDF_READING" | "REVIEW";

export type OfflineSessionPayload = {
  localSessionId: string;
  serverSessionId: string | null;
  serverVersion: number | null;
  mode: OfflineStudyMode;
  disciplineId: string;
  subjectId: string;
  cycleEntryId: string | null;
  disciplineName: string;
  subjectName: string;
  startedAt: string;
  pausedAt: string | null;
  finishedAt: string | null;
  accumulatedSeconds: number;
  questions: number;
  correct: number;
  wrong: number;
  activityType?: OfflineActivityType;
  advanceCycle?: boolean;
  difficulty: OfflineDifficulty;
  notes: string | null;
  date: string;
};

export type OfflineSessionOperation = {
  operationId: string;
  userId: string;
  studyGuideId: string;
  type: OfflineSessionOperationType;
  payload: OfflineSessionPayload;
  createdAt: string;
  attempts: number;
  status: OfflineSessionOperationStatus;
  lastError: string | null;
  syncedAt: string | null;
  schemaVersion: number;
};

export type OfflineActiveStudySession = OfflineSessionPayload & {
  userId: string;
  studyGuideId: string;
  status: "ACTIVE" | "PAUSED" | "FINISHED" | "CANCELLED";
  updatedAt: string;
  pendingSync: boolean;
};

export interface OfflineSessionQueueStorage {
  putOperation(operation: OfflineSessionOperation): Promise<void>;
  getOperations(userId: string, studyGuideId: string): Promise<OfflineSessionOperation[]>;
  putSession(session: OfflineActiveStudySession): Promise<void>;
  getSession(userId: string, studyGuideId: string): Promise<OfflineActiveStudySession | null>;
  updateOperation(operationId: string, patch: Partial<OfflineSessionOperation>): Promise<void>;
  updateOperationsForSession(localSessionId: string, patch: Partial<OfflineSessionPayload>): Promise<void>;
}

function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sessionKey(userId: string, studyGuideId: string) {
  return `${userId}:${studyGuideId}`;
}

function ensurePayload(payload: OfflineSessionPayload) {
  if (!payload.disciplineId || !payload.subjectId) {
    throw new Error("Disciplina e assunto são obrigatórios para uma sessão offline.");
  }
  if (payload.mode === "AVULSO" && !payload.subjectId) {
    throw new Error("O estudo avulso offline exige subjectId.");
  }
  if (payload.questions < 0 || payload.correct < 0 || payload.wrong < 0 || payload.correct + payload.wrong !== payload.questions) {
    throw new Error("Questões, acertos e erros da sessão offline são inválidos.");
  }
}

export function createOfflineSessionOperation(input: {
  operationId?: string;
  userId: string;
  studyGuideId: string;
  type: OfflineSessionOperationType;
  payload: OfflineSessionPayload;
  createdAt?: string;
}): OfflineSessionOperation {
  ensurePayload(input.payload);
  return {
    operationId: input.operationId ?? uuid(),
    userId: input.userId,
    studyGuideId: input.studyGuideId,
    type: input.type,
    payload: structuredClone(input.payload),
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: 0,
    status: "PENDING",
    lastError: null,
    syncedAt: null,
    schemaVersion: OFFLINE_SESSION_SCHEMA_VERSION,
  };
}

export type MemoryOfflineSessionQueueState = { operations: Map<string, OfflineSessionOperation>; sessions: Map<string, OfflineActiveStudySession> };

export class MemoryOfflineSessionQueue implements OfflineSessionQueueStorage {
  private operations: Map<string, OfflineSessionOperation>;
  private sessions: Map<string, OfflineActiveStudySession>;
  constructor(state: MemoryOfflineSessionQueueState = { operations: new Map(), sessions: new Map() }) { this.operations = state.operations; this.sessions = state.sessions; }

  async putOperation(operation: OfflineSessionOperation) { this.operations.set(operation.operationId, structuredClone(operation)); }
  async getOperations(userId: string, studyGuideId: string) {
    return [...this.operations.values()].filter((item) => item.userId === userId && item.studyGuideId === studyGuideId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((item) => structuredClone(item));
  }
  async putSession(session: OfflineActiveStudySession) { this.sessions.set(sessionKey(session.userId, session.studyGuideId), structuredClone(session)); }
  async getSession(userId: string, studyGuideId: string) { return structuredClone(this.sessions.get(sessionKey(userId, studyGuideId)) ?? null); }
  async updateOperation(operationId: string, patch: Partial<OfflineSessionOperation>) {
    const current = this.operations.get(operationId); if (current) this.operations.set(operationId, { ...current, ...structuredClone(patch) });
  }
  async updateOperationsForSession(localSessionId: string, patch: Partial<OfflineSessionPayload>) {
    for (const [id, operation] of this.operations) if (operation.payload.localSessionId === localSessionId) this.operations.set(id, { ...operation, payload: { ...operation.payload, ...structuredClone(patch) } });
  }
}

type StoredSession = OfflineActiveStudySession & { storageKey: string };
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB não está disponível neste navegador.");
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_SESSION_DB_NAME, OFFLINE_SESSION_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("operations")) database.createObjectStore("operations", { keyPath: "operationId" });
      if (!database.objectStoreNames.contains("sessions")) database.createObjectStore("sessions", { keyPath: "storageKey" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

async function transaction(storeName: "operations" | "sessions", mode: IDBTransactionMode) {
  const database = await openDatabase();
  return database.transaction(storeName, mode).objectStore(storeName);
}

export class IndexedDbOfflineSessionQueue implements OfflineSessionQueueStorage {
  async putOperation(operation: OfflineSessionOperation) { await requestResult((await transaction("operations", "readwrite")).put(operation)); emitQueueChange(); }
  async getOperations(userId: string, studyGuideId: string) {
    const values = await requestResult((await transaction("operations", "readonly")).getAll()) as OfflineSessionOperation[];
    return values.filter((item) => item.userId === userId && item.studyGuideId === studyGuideId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async putSession(session: OfflineActiveStudySession) { await requestResult((await transaction("sessions", "readwrite")).put({ ...session, storageKey: sessionKey(session.userId, session.studyGuideId) } satisfies StoredSession)); emitQueueChange(); }
  async getSession(userId: string, studyGuideId: string) {
    const value = await requestResult((await transaction("sessions", "readonly")).get(sessionKey(userId, studyGuideId))) as StoredSession | undefined;
    if (!value) return null; const session = { ...value }; Reflect.deleteProperty(session, "storageKey"); return session;
  }
  async updateOperation(operationId: string, patch: Partial<OfflineSessionOperation>) {
    const store = await transaction("operations", "readwrite"); const current = await requestResult(store.get(operationId)) as OfflineSessionOperation | undefined;
    if (current) { await requestResult(store.put({ ...current, ...patch })); emitQueueChange(); }
  }
  async updateOperationsForSession(localSessionId: string, patch: Partial<OfflineSessionPayload>) {
    const store = await transaction("operations", "readwrite"); const values = await requestResult(store.getAll()) as OfflineSessionOperation[];
    await Promise.all(values.filter((item) => item.payload.localSessionId === localSessionId).map((item) => requestResult(store.put({ ...item, payload: { ...item.payload, ...patch } })))); emitQueueChange();
  }
}

export const offlineSessionQueue = new IndexedDbOfflineSessionQueue();

function emitQueueChange() { if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_SESSION_CHANGE_EVENT)); }
export function subscribeOfflineSessionQueue(listener: () => void) { if (typeof window === "undefined") return () => undefined; window.addEventListener(OFFLINE_SESSION_CHANGE_EVENT, listener); return () => window.removeEventListener(OFFLINE_SESSION_CHANGE_EVENT, listener); }

export async function persistServerActiveSession(input: {
  userId: string;
  studyGuideId: string;
  session: { id: string; mode: OfflineStudyMode; status: "ACTIVE" | "PAUSED"; version: number; startedAt: string; accumulatedSeconds: number; pausedAt: string | null; cycle: { entryId: string } | null; discipline: { id: string; name: string }; subject: { id: string; name: string } };
}) {
  const current = await offlineSessionQueue.getSession(input.userId, input.studyGuideId);
  if (current?.pendingSync) return current;
  const now = new Date().toISOString();
  const session: OfflineActiveStudySession = {
    userId: input.userId, studyGuideId: input.studyGuideId, localSessionId: input.session.id,
    serverSessionId: input.session.id, serverVersion: input.session.version, mode: input.session.mode,
    status: input.session.status, disciplineId: input.session.discipline.id, subjectId: input.session.subject.id,
    cycleEntryId: input.session.cycle?.entryId ?? null, disciplineName: input.session.discipline.name,
    subjectName: input.session.subject.name, startedAt: input.session.startedAt, pausedAt: input.session.pausedAt,
    finishedAt: null, accumulatedSeconds: input.session.accumulatedSeconds, questions: 0, correct: 0, wrong: 0,
    difficulty: null, notes: null, date: input.session.startedAt, updatedAt: now, pendingSync: false,
  };
  await offlineSessionQueue.putSession(session); return session;
}

export async function queueOfflineSessionOperation(input: {
  userId: string;
  studyGuideId: string;
  type: OfflineSessionOperationType;
  session: OfflineActiveStudySession;
  now?: string;
  operationId?: string;
}, storage: OfflineSessionQueueStorage = offlineSessionQueue) {
  const now = input.now ?? new Date().toISOString();
  const session = { ...input.session };
  if (input.type === "PAUSE_SESSION" && session.status === "ACTIVE") {
    session.accumulatedSeconds += Math.max(0, Math.floor((new Date(now).getTime() - new Date(session.pausedAt ?? session.startedAt).getTime()) / 1000));
    session.status = "PAUSED"; session.pausedAt = now;
  } else if (input.type === "RESUME_SESSION" && session.status === "PAUSED") {
    session.status = "ACTIVE"; session.pausedAt = now;
  } else if (input.type === "FINISH_SESSION" || input.type === "CREATE_STANDALONE_SESSION") {
    session.status = "FINISHED"; session.finishedAt = now;
  } else if (input.type === "CANCEL_SESSION") {
    session.status = "CANCELLED"; session.finishedAt = now;
  }
  session.updatedAt = now; session.pendingSync = true;
  const operation = createOfflineSessionOperation({ operationId: input.operationId, userId: input.userId, studyGuideId: input.studyGuideId, type: input.type, payload: session, createdAt: now });
  await storage.putOperation(operation);
  await storage.putSession(session);
  return { operation, session };
}

export async function startOfflineActiveSession(input: {
  userId: string; studyGuideId: string; mode: OfflineStudyMode; disciplineId: string; subjectId: string;
  cycleEntryId: string | null; disciplineName: string; subjectName: string; startedAt?: string; operationId?: string; timerRunning?: boolean;
}, storage: OfflineSessionQueueStorage = offlineSessionQueue) {
  if (!input.disciplineId || !input.subjectId) throw new Error("Disciplina e assunto são obrigatórios.");
  const operationId = input.operationId ?? uuid(); const now = input.startedAt ?? new Date().toISOString();
  const timerRunning = input.timerRunning ?? true;
  const session: OfflineActiveStudySession = {
    ...input, startedAt: now, localSessionId: `offline-${operationId}`, serverSessionId: null, serverVersion: null,
    status: timerRunning ? "ACTIVE" : "PAUSED", pausedAt: timerRunning ? now : null, finishedAt: null, accumulatedSeconds: 0, questions: 0,
    correct: 0, wrong: 0, difficulty: null, notes: null, date: now, updatedAt: now, pendingSync: true,
  };
  const operation = createOfflineSessionOperation({ operationId, userId: input.userId, studyGuideId: input.studyGuideId, type: "START_SESSION", payload: session, createdAt: now });
  await storage.putOperation(operation); await storage.putSession(session);
  return { operation, session };
}

export async function createStandaloneOfflineSession(input: Omit<OfflineActiveStudySession, "localSessionId" | "serverSessionId" | "serverVersion" | "status" | "updatedAt" | "pendingSync">, storage: OfflineSessionQueueStorage = offlineSessionQueue) {
  if (!input.subjectId) throw new Error("O estudo avulso offline exige subjectId.");
  const operationId = uuid(); const now = new Date().toISOString();
  const session: OfflineActiveStudySession = { ...input, localSessionId: `offline-${operationId}`, serverSessionId: null, serverVersion: null, status: "FINISHED", updatedAt: now, pendingSync: true };
  const operation = createOfflineSessionOperation({ operationId, userId: input.userId, studyGuideId: input.studyGuideId, type: "CREATE_STANDALONE_SESSION", payload: session, createdAt: now });
  await storage.putOperation(operation); await storage.putSession(session);
  return { operation, session };
}
