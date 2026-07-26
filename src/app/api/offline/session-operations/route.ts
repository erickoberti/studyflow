import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { CycleConflictError, cycleService } from "@/lib/cycle-service";
import { canonicalSessionOperationPayload, claimOfflineOperation, completeOfflineOperation, failOfflineOperation } from "@/lib/offline-operation-ledger";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  localSessionId: z.string().min(1), serverSessionId: z.string().nullable(), serverVersion: z.number().int().nullable(),
  mode: z.enum(["CYCLE", "AVULSO"]), disciplineId: z.string().min(1), subjectId: z.string().min(1),
  cycleEntryId: z.string().nullable(), startedAt: z.string(), accumulatedSeconds: z.number().int().min(0),
  questions: z.number().int().min(0), correct: z.number().int().min(0), wrong: z.number().int().min(0),
  difficulty: z.enum(["Fácil", "Média", "Difícil"]).nullable(), notes: z.string().nullable(),
}).passthrough();

const operationSchema = z.object({
  operationId: z.string().min(1), userId: z.string().min(1), studyGuideId: z.string().min(1),
  type: z.enum(["START_SESSION", "PAUSE_SESSION", "RESUME_SESSION", "FINISH_SESSION", "CANCEL_SESSION", "CREATE_STANDALONE_SESSION"]),
  payload: payloadSchema,
});

function notes(payload: z.infer<typeof payloadSchema>) { return [payload.difficulty ? `[${payload.difficulty}]` : "", payload.notes?.trim() ?? ""].filter(Boolean).join(" ") || undefined; }

async function executeOperation(userId: string, operation: z.infer<typeof operationSchema>) {
  const payload = operation.payload;
  if (operation.type === "START_SESSION") {
    const session = await cycleService.start(userId, operation.studyGuideId, { mode: payload.mode, disciplineId: payload.disciplineId, subjectId: payload.subjectId, operationId: operation.operationId });
    return { operationId: operation.operationId, session };
  }
  if (operation.type === "CREATE_STANDALONE_SESSION") {
    const active = await cycleService.start(userId, operation.studyGuideId, { mode: "AVULSO", disciplineId: payload.disciplineId, subjectId: payload.subjectId, operationId: operation.operationId });
    if (!active) throw new Error("Não foi possível criar a sessão avulsa.");
    if (active.id !== operation.operationId && (active.mode !== "AVULSO" || active.subject.id !== payload.subjectId)) throw new CycleConflictError("Existe outra sessão ativa no servidor; o estudo avulso foi preservado.", "OTHER_ACTIVE_SESSION");
    const result = await cycleService.finish(userId, operation.studyGuideId, active.id, active.version, { questions: payload.questions, correct: payload.correct, minutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), notes: notes(payload) });
    return { operationId: operation.operationId, serverSessionId: active.id, version: active.version, ...result };
  }
  if (!payload.serverSessionId || payload.serverVersion === null) throw new CycleConflictError("A sessão ainda não existe no servidor.", "SESSION_NOT_SYNCHRONIZED");
  if (operation.type === "PAUSE_SESSION") return { operationId: operation.operationId, session: await cycleService.pause(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion) };
  if (operation.type === "RESUME_SESSION") return { operationId: operation.operationId, session: await cycleService.resume(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion) };
  if (operation.type === "CANCEL_SESSION") return { operationId: operation.operationId, ...(await cycleService.cancel(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion)) };
  if (payload.questions <= 0 || payload.correct + payload.wrong !== payload.questions) throw new Error("A finalização exige ao menos uma questão e total consistente.");
  return { operationId: operation.operationId, ...(await cycleService.finish(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion, { questions: payload.questions, correct: payload.correct, minutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), notes: notes(payload) })) };
}

export async function POST(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  const parsed = operationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Operação offline inválida.", issues: parsed.error.flatten() }, { status: 400 });
  const operation = parsed.data;
  if (operation.userId !== auth.user.id) return NextResponse.json({ message: "A operação pertence a outro usuário." }, { status: 403 });
  const ownsGuide = await prisma.studyGuide.count({ where: { id: operation.studyGuideId, userId: auth.user.id } });
  if (!ownsGuide) return NextResponse.json({ message: "O guia da operação não pertence ao usuário autenticado." }, { status: 403 });
  const canonicalPayload = canonicalSessionOperationPayload({ type: operation.type, mode: operation.payload.mode, disciplineId: operation.payload.disciplineId, subjectId: operation.payload.subjectId, sessionId: operation.payload.serverSessionId, version: operation.payload.serverVersion, questions: operation.payload.questions, correct: operation.payload.correct, minutes: Math.max(1, Math.round(operation.payload.accumulatedSeconds / 60)), notes: notes(operation.payload) });
  const claim = await claimOfflineOperation({ operationId: operation.operationId, userId: auth.user.id, studyGuideId: operation.studyGuideId, type: operation.type, payload: canonicalPayload });
  if (claim.kind === "REPLAY") return NextResponse.json({ ...(claim.response as object), idempotentReplay: true });
  if (claim.kind === "PENDING") return NextResponse.json({ operationId: operation.operationId, pending: true }, { status: 202 });
  if (claim.kind === "CONFLICT") return NextResponse.json({ operationId: operation.operationId, message: claim.message, conflict: true }, { status: 409 });
  try {
    const response = await executeOperation(auth.user.id, operation);
    await completeOfflineOperation(claim.recordId, claim.version, response);
    return NextResponse.json(response);
  } catch (error) {
    const conflict = error instanceof CycleConflictError;
    const message = error instanceof Error ? error.message : "Falha temporária ao sincronizar a operação.";
    await failOfflineOperation(claim.recordId, claim.version, { conflict, message });
    return NextResponse.json({ operationId: operation.operationId, message, conflict, code: conflict ? error.code : "TEMPORARY_FAILURE" }, { status: conflict ? 409 : 503 });
  }
}
