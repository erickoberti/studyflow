import type { OfflineSessionOperation, OfflineSessionQueueStorage } from "@/lib/offline/active-session-queue";

export type OfflineOperationTransportResponse = { status: number; data: Record<string, unknown> };
export type OfflineOperationTransport = (operation: OfflineSessionOperation) => Promise<OfflineOperationTransportResponse>;

export function retryDelay(attempt: number) { return Math.min(4_000, 250 * 2 ** Math.max(0, attempt - 1)); }
export function isTemporarySyncFailure(status: number) { return status === 202 || status === 408 || status === 425 || status === 429 || status >= 500; }

export async function synchronizeOfflineSessionQueue(input: {
  storage: OfflineSessionQueueStorage; userId: string; studyGuideId: string; transport: OfflineOperationTransport;
  maxAttempts?: number; wait?: (milliseconds: number) => Promise<void>; now?: () => string;
}) {
  const maxAttempts = input.maxAttempts ?? 3;
  const wait = input.wait ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? (() => new Date().toISOString());
  const candidates = (await input.storage.getOperations(input.userId, input.studyGuideId)).filter((item) => item.status === "PENDING" || item.status === "FAILED");
  const completed: string[] = []; const conflicts: string[] = []; const failed: string[] = [];

  for (const candidate of candidates) {
    let operation = (await input.storage.getOperations(input.userId, input.studyGuideId)).find((item) => item.operationId === candidate.operationId) ?? candidate;
    let response: OfflineOperationTransportResponse | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await input.storage.updateOperation(operation.operationId, { status: "SYNCING", attempts: operation.attempts + attempt, lastError: null });
      try { response = await input.transport(operation); }
      catch (error) { response = { status: 503, data: { message: error instanceof Error ? error.message : "Falha de conexão." } }; }
      if (!isTemporarySyncFailure(response.status) || attempt === maxAttempts) break;
      await wait(retryDelay(attempt));
      operation = (await input.storage.getOperations(input.userId, input.studyGuideId)).find((item) => item.operationId === candidate.operationId) ?? operation;
    }
    if (!response) continue;
    const message = typeof response.data.message === "string" ? response.data.message : "Não foi possível sincronizar a operação.";
    if (response.status >= 200 && response.status < 300 && response.status !== 202) {
      const session = response.data.session as { id?: string; version?: number } | undefined;
      const serverSessionId = session?.id ?? (typeof response.data.serverSessionId === "string" ? response.data.serverSessionId : null);
      const serverVersion = session?.version ?? (typeof response.data.version === "number" ? response.data.version : null);
      if (serverSessionId) await input.storage.updateOperationsForSession(operation.payload.localSessionId, { serverSessionId, serverVersion: serverVersion ?? operation.payload.serverVersion });
      await input.storage.updateOperation(operation.operationId, { status: "COMPLETED", syncedAt: now(), lastError: null });
      const local = await input.storage.getSession(input.userId, input.studyGuideId);
      if (local?.localSessionId === operation.payload.localSessionId) {
        const remaining = (await input.storage.getOperations(input.userId, input.studyGuideId)).some((item) => item.operationId !== operation.operationId && item.payload.localSessionId === operation.payload.localSessionId && ["PENDING", "SYNCING", "FAILED", "CONFLICT"].includes(item.status));
        await input.storage.putSession({ ...local, serverSessionId: serverSessionId ?? local.serverSessionId, serverVersion: serverVersion ?? local.serverVersion, pendingSync: remaining, updatedAt: now() });
      }
      completed.push(operation.operationId); continue;
    }
    if (response.status === 409) {
      await input.storage.updateOperation(operation.operationId, { status: "CONFLICT", lastError: message }); conflicts.push(operation.operationId); break;
    }
    if (response.status === 400 || response.status === 422) {
      await input.storage.updateOperation(operation.operationId, { status: "CANCELLED", lastError: message }); failed.push(operation.operationId); continue;
    }
    await input.storage.updateOperation(operation.operationId, { status: "FAILED", lastError: message }); failed.push(operation.operationId); break;
  }
  return { completed, conflicts, failed };
}
