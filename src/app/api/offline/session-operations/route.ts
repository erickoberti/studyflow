import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { CycleConflictError, cycleService } from "@/lib/cycle-service";
import { canonicalSessionOperationPayload, claimOfflineOperation, completeOfflineOperation, failOfflineOperation } from "@/lib/offline-operation-ledger";
import { prisma } from "@/lib/prisma";
import { createGeneralReviewSession, createStandaloneStudySession, formatSaoPauloStudyInput } from "@/lib/standalone-study-session";

const payloadSchema = z.object({
  localSessionId: z.string().min(1), serverSessionId: z.string().nullable(), serverVersion: z.number().int().nullable(),
  mode: z.enum(["CYCLE", "AVULSO"]), scope: z.enum(["SUBJECT", "GENERAL"]).optional(), disciplineId: z.string().min(1).nullable(), subjectId: z.string().min(1).nullable(),
  cycleEntryId: z.string().nullable(), status: z.enum(["ACTIVE", "PAUSED", "FINISHED", "CANCELLED"]).optional(), startedAt: z.string(), accumulatedSeconds: z.number().int().min(0),
  questions: z.number().int().min(0), correct: z.number().int().min(0), wrong: z.number().int().min(0),
  activityType: z.enum(["QUESTIONS", "CLASS", "READING", "PDF_READING", "REVIEW"]).optional(), advanceCycle: z.boolean().optional(),
  difficulty: z.enum(["Fácil", "Média", "Difícil"]).nullable(), notes: z.string().nullable(), date: z.string().datetime(),
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
    if (!payload.disciplineId || !payload.subjectId) throw new Error("Disciplina e assunto são obrigatórios para iniciar a sessão.");
    const session = await cycleService.start(userId, operation.studyGuideId, { mode: payload.mode, disciplineId: payload.disciplineId, subjectId: payload.subjectId, operationId: operation.operationId, timerRunning: payload.status !== "PAUSED" });
    return { operationId: operation.operationId, session };
  }
  if (operation.type === "CREATE_STANDALONE_SESSION") {
    const when = new Date(payload.date);
    if (Number.isNaN(when.getTime())) throw new Error("A data do estudo avulso offline é inválida.");
    const local = formatSaoPauloStudyInput(when);
    const created = await prisma.$transaction((tx) => payload.scope === "GENERAL"
      ? createGeneralReviewSession(tx, { userId, studyGuideId: operation.studyGuideId, ...local, correct: payload.correct, wrong: payload.wrong, estimatedMinutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), difficulty: payload.difficulty ?? "Média", notes: payload.notes })
      : (() => {
          if (!payload.disciplineId || !payload.subjectId) throw new Error("O estudo avulso offline exige disciplina e assunto.");
          return createStandaloneStudySession(tx, { userId, studyGuideId: operation.studyGuideId, disciplineId: payload.disciplineId, subjectId: payload.subjectId, ...local, correct: payload.correct, wrong: payload.wrong, estimatedMinutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), difficulty: payload.difficulty ?? "Média", activityType: payload.activityType ?? "QUESTIONS", notes: payload.notes });
        })());
    return { operationId: operation.operationId, serverSessionId: created.id };
  }
  if (!payload.serverSessionId || payload.serverVersion === null) throw new CycleConflictError("A sessão ainda não existe no servidor.", "SESSION_NOT_SYNCHRONIZED");
  if (operation.type === "PAUSE_SESSION") return { operationId: operation.operationId, session: await cycleService.pause(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion) };
  if (operation.type === "RESUME_SESSION") return { operationId: operation.operationId, session: await cycleService.resume(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion) };
  if (operation.type === "CANCEL_SESSION") return { operationId: operation.operationId, ...(await cycleService.cancel(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion)) };
  if (payload.questions < 0 || payload.correct + payload.wrong !== payload.questions) throw new Error("A finalização exige resultados consistentes.");
  return { operationId: operation.operationId, ...(await cycleService.finish(userId, operation.studyGuideId, payload.serverSessionId, payload.serverVersion, { questions: payload.questions, correct: payload.correct, minutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), activityType: payload.activityType ?? "QUESTIONS", advanceCycle: payload.advanceCycle ?? true, notes: notes(payload) })) };
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
  const canonicalPayload = canonicalSessionOperationPayload({ type: operation.type, mode: operation.payload.mode, scope: operation.payload.scope, disciplineId: operation.payload.disciplineId, subjectId: operation.payload.subjectId, timerRunning: operation.payload.status !== "PAUSED", sessionId: operation.payload.serverSessionId, version: operation.payload.serverVersion, questions: operation.payload.questions, correct: operation.payload.correct, minutes: Math.max(1, Math.round(operation.payload.accumulatedSeconds / 60)), activityType: operation.payload.activityType, advanceCycle: operation.payload.advanceCycle, notes: notes(operation.payload), date: operation.payload.date });
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
