import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PROCESSING_LEASE_MS = 60_000;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

export function hashOfflineOperation(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function canonicalSessionOperationPayload(input: {
  type: string; mode?: string; disciplineId?: string; subjectId?: string; sessionId?: string | null;
  version?: number | null; timerRunning?: boolean; questions?: number; correct?: number; minutes?: number; notes?: string; date?: string;
}) {
  if (input.type === "START_SESSION") return input.mode === "AVULSO" ? { mode: input.mode, disciplineId: input.disciplineId, subjectId: input.subjectId, timerRunning: input.timerRunning ?? true } : { mode: "CYCLE", timerRunning: input.timerRunning ?? true };
  if (input.type === "CREATE_STANDALONE_SESSION") return { mode: "AVULSO", disciplineId: input.disciplineId, subjectId: input.subjectId, questions: input.questions, correct: input.correct, minutes: input.minutes, notes: input.notes, date: input.date };
  return { sessionId: input.sessionId, version: input.version, ...(input.type === "FINISH_SESSION" ? { questions: input.questions, correct: input.correct, minutes: input.minutes, notes: input.notes } : {}) };
}

export type OperationClaim =
  | { kind: "PROCESS"; recordId: string; version: number }
  | { kind: "REPLAY"; response: unknown }
  | { kind: "PENDING" }
  | { kind: "CONFLICT"; message: string };

export async function claimOfflineOperation(input: { operationId: string; userId: string; studyGuideId: string; type: string; payload: unknown }): Promise<OperationClaim> {
  const payloadHash = hashOfflineOperation({ type: input.type, payload: input.payload });
  try {
    const created = await prisma.offlineOperation.create({ data: { operationId: input.operationId, userId: input.userId, studyGuideId: input.studyGuideId, type: input.type, status: "SYNCING", payloadHash, attempts: 1 } });
    return { kind: "PROCESS", recordId: created.id, version: created.version };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }

  const existing = await prisma.offlineOperation.findUnique({ where: { operationId: input.operationId } });
  if (!existing || existing.userId !== input.userId || existing.studyGuideId !== input.studyGuideId) return { kind: "CONFLICT", message: "operationId já pertence a outro contexto." };
  if (existing.payloadHash !== payloadHash || existing.type !== input.type) return { kind: "CONFLICT", message: "operationId foi reutilizado com dados diferentes." };
  if (existing.status === "COMPLETED") return { kind: "REPLAY", response: existing.response };
  if (existing.status === "CONFLICT" || existing.status === "CANCELLED") return { kind: "CONFLICT", message: existing.lastError ?? "A operação foi encerrada por conflito." };
  const leaseActive = existing.status === "SYNCING" && Date.now() - existing.updatedAt.getTime() < PROCESSING_LEASE_MS;
  if (leaseActive) return { kind: "PENDING" };
  const acquired = await prisma.offlineOperation.updateMany({ where: { id: existing.id, version: existing.version, status: { in: ["PENDING", "FAILED", "SYNCING"] } }, data: { status: "SYNCING", attempts: { increment: 1 }, lastError: null, version: { increment: 1 } } });
  if (!acquired.count) return { kind: "PENDING" };
  return { kind: "PROCESS", recordId: existing.id, version: existing.version + 1 };
}

export async function completeOfflineOperation(recordId: string, version: number, response: unknown) {
  const result = await prisma.offlineOperation.updateMany({ where: { id: recordId, version, status: "SYNCING" }, data: { status: "COMPLETED", response: response as Prisma.InputJsonValue, syncedAt: new Date(), lastError: null, version: { increment: 1 } } });
  if (!result.count) throw new Error("O ledger da operação foi alterado concorrentemente.");
}

export async function failOfflineOperation(recordId: string, version: number, input: { conflict: boolean; message: string }) {
  await prisma.offlineOperation.updateMany({ where: { id: recordId, version, status: "SYNCING" }, data: { status: input.conflict ? "CONFLICT" : "FAILED", lastError: input.message, version: { increment: 1 } } });
}
