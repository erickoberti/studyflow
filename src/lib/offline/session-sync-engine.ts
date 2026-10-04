import type { OfflineSessionOperation, OfflineSessionQueueStorage } from "@/lib/offline/active-session-queue";

export type OfflineOperationTransportResponse = { status: number; data: Record<string, unknown> };
export type OfflineOperationTransport = (operation: OfflineSessionOperation) => Promise<OfflineOperationTransportResponse>;

export function retryDelay(attempt: number) { return Math.min(4_000, 250 * 2 ** Math.max(0, attempt - 1)); }
export function isTemporarySyncFailure(status: number) { return status === 202 || status === 408 || status === 425 || status === 429 || status >= 500; }

export async function synchronizeOfflineSessionQueue(input: {
  storage: OfflineSessionQueueStorage; userId: string; studyGuideId: string; transport: OfflineOperationTransport;
  maxAttempts?: number; wait?: (milliseconds: number) => Promise<void>; now?: () => string; assertAccount?: () => void;
}) {
  const maxAttempts = input.maxAttempts ?? 3;
  const wait = input.wait ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? (() => new Date().toISOString());
  const pending = (await input.storage.getOperations(input.userId, input.studyGuideId)).filter((item) => ["PENDING", "SYNCING", "FAILED"].includes(item.status));
  const candidates: typeof pending = [];
  while (pending.length) {
    const index = pending.findIndex((item) => !pending.some((other) => other.operationId === item.dependsOnOperationId));
    candidates.push(...pending.splice(index < 0 ? 0 : index, 1));
  }
  const completed: string[] = []; const conflicts: string[] = []; const failed: string[] = []; const blocked: string[] = [];

  for (const candidate of candidates) {
    input.assertAccount?.();
    const queue = await input.storage.getOperations(input.userId, input.studyGuideId);
    const index = queue.findIndex((item) => item.operationId === candidate.operationId);
    if (index < 0) continue;
    let operation = queue[index];
    if (!["PENDING", "SYNCING", "FAILED"].includes(operation.status)) continue;
    const dependency = operation.dependsOnOperationId ? queue.find((item) => item.operationId === operation.dependsOnOperationId) : null;
    const previousIncomplete = queue.slice(0, index).some((item) => item.payload.localSessionId === operation.payload.localSessionId && item.dependsOnOperationId !== operation.operationId && item.status !== "COMPLETED");
    if ((operation.dependsOnOperationId && dependency?.status !== "COMPLETED") || previousIncomplete) {
      await input.storage.updateOperation(operation.operationId, { lastError: "Aguardando a conclusão da operação anterior desta sessão." });
      blocked.push(operation.operationId);
      continue;
    }
    let response: OfflineOperationTransportResponse | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      input.assertAccount?.();
      await input.storage.updateOperation(operation.operationId, { status: "SYNCING", attempts: operation.attempts + 1 });
      try { response = await input.transport(operation); }
      catch (error) { response = { status: 503, data: { message: error instanceof Error ? error.message : "Falha de conexão." } }; }
      input.assertAccount?.();
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
      await input.storage.updateOperation(operation.operationId, { status: "CONFLICT", lastError: message }); conflicts.push(operation.operationId); continue;
    }
    if (response.status === 400 || response.status === 422) {
      await input.storage.updateOperation(operation.operationId, { status: "CANCELLED", lastError: message }); failed.push(operation.operationId); continue;
    }
    await input.storage.updateOperation(operation.operationId, { status: "FAILED", lastError: message }); failed.push(operation.operationId);
    if (response.status === 401 || response.status === 403) break;
  }
  return { completed, conflicts, failed, blocked };
}
