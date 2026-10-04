import type { OfflinePendingOperation } from "@/lib/offline/types";

export type StructuralOperationResult = {
  id: string;
  status: "completed" | "already_processed" | "rejected" | "error" | "blocked";
  serverId?: string;
  message?: string;
};

export function structuralOperationKeys(operation: OfflinePendingOperation) {
  const payload = operation.payload;
  const target = operation.entity === "guide-selection"
    ? "guide-selection:account"
    : `${operation.entity}:${String(operation.action === "create" ? payload.clientId : operation.entity === "settings" ? payload.guideId : payload.id)}`;
  const references = [target];
  if (typeof payload.guideId === "string") references.push(`guide:${payload.guideId}`);
  if (typeof payload.disciplineId === "string") references.push(`discipline:${payload.disciplineId}`);
  if (operation.entity === "guide-selection" && typeof payload.id === "string") references.push(`guide:${payload.id}`);
  return { target, references };
}

export function confirmedStructuralOperationIds(
  operations: OfflinePendingOperation[],
  response: unknown,
  userId: string,
) {
  if (!response || typeof response !== "object") return [];
  const body = response as { userId?: unknown; results?: unknown };
  if (body.userId !== userId || !Array.isArray(body.results)) return [];
  const counts = new Map<string, number>();
  const outcomes = new Map<string, { status?: unknown; serverId?: unknown }>();
  for (const value of body.results) {
    if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
      const id = (value as { id: string }).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      outcomes.set(id, value as { status?: unknown; serverId?: unknown });
    }
  }
  const confirmed: string[] = [];
  const unconfirmedKeys = new Set<string>();
  for (const operation of [...operations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const { target, references } = structuralOperationKeys(operation);
    const result = outcomes.get(operation.id);
    const mapped = operation.action !== "create" || (typeof result?.serverId === "string" && result.serverId === operation.payload.clientId);
    if (counts.get(operation.id) === 1 && (result?.status === "completed" || result?.status === "already_processed") && mapped && references.every((key) => !unconfirmedKeys.has(key))) {
      confirmed.push(operation.id);
    } else {
      unconfirmedKeys.add(target);
    }
  }
  return confirmed;
}
