export type StudyTimerState = {
  status: "ACTIVE" | "PAUSED" | "FINISHING" | "FINISHED" | "CANCELLED";
  startedAt: string | Date;
  pausedAt: string | Date | null;
  accumulatedSeconds: number;
};

function timestamp(value: string | Date) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Rebuilds the timer from persisted timestamps. `pausedAt` is the beginning of
 * the current running interval for active sessions; legacy records fall back
 * to `startedAt`.
 */
export function calculateElapsedSeconds(session: StudyTimerState, now: string | Date | number = Date.now()) {
  const accumulated = Math.max(0, Math.floor(session.accumulatedSeconds));
  if (session.status !== "ACTIVE") return accumulated;

  const nowMs = typeof now === "number" ? now : timestamp(now);
  const runningSinceMs = timestamp(session.pausedAt ?? session.startedAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(runningSinceMs)) return accumulated;

  return accumulated + Math.max(0, Math.floor((nowMs - runningSinceMs) / 1000));
}
