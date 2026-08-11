export type OfflineUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export type OfflineGuide = {
  id: string;
  serverId: string | null;
  name: string;
  icon: string;
  color: string;
  description: string | null;
};

export type OfflineSettings = {
  targetPercentage: number;
  dailyQuestionsGoal: number;
  weeklyQuestionsGoal: number;
  weightPriorityBias: number;
};

export type OfflineDiscipline = {
  id: string;
  serverId: string | null;
  guideId: string;
  name: string;
  category: string | null;
  sortOrder: number | null;
  active: boolean;
};

export type OfflineSubject = {
  id: string;
  serverId: string | null;
  guideId: string;
  disciplineId: string;
  name: string;
  weight: number;
  notes: string | null;
  tecReference: string | null;
  active: boolean;
  orderIndex: number | null;
};

export type OfflineCycleEntry = {
  id: string;
  serverId: string | null;
  guideId: string;
  subjectId: string;
  orderIndex: number;
  active: boolean;
};

export type OfflineSessionSyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "error";

export type OfflineStudySession = {
  id: string;
  serverId: string | null;
  cycleEntryId: string;
  date: string;
  questions: number;
  correct: number;
  wrong: number;
  percentage: number;
  estimatedMinutes: number;
  activityType?: "QUESTIONS" | "CLASS" | "READING" | "REVIEW";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: OfflineSessionSyncStatus;
  syncError: string | null;
};

export type OfflineSnapshot = {
  version: number;
  user: OfflineUser | null;
  guides: OfflineGuide[];
  activeGuideId: string | null;
  settings: OfflineSettings | null;
  disciplines: OfflineDiscipline[];
  subjects: OfflineSubject[];
  cycleEntries: OfflineCycleEntry[];
  sessions: OfflineStudySession[];
  pendingOperations: OfflinePendingOperation[];
  lastSyncedAt: string | null;
};

export type OfflineAccessSession = {
  email: string;
  name: string;
  unlockedAt: string;
};

export type OfflinePendingOperation = {
  id: string;
  entity: "guide" | "discipline" | "subject" | "settings" | "guide-selection";
  action: "create" | "update" | "delete" | "upsert" | "select";
  payload: Record<string, unknown>;
  createdAt: string;
};
