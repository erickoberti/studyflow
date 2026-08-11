import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { CycleConflictError, cycleService } from "@/lib/cycle-service";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { canonicalSessionOperationPayload, claimOfflineOperation, completeOfflineOperation, failOfflineOperation } from "@/lib/offline-operation-ledger";

const commandSchema = z.object({ command: z.enum(["start", "pause", "resume", "cancel", "finish"]), operationId: z.string().min(1).optional(), id: z.string().optional(), version: z.number().int().optional(), mode: z.enum(["CYCLE", "AVULSO"]).optional(), disciplineId: z.string().optional(), subjectId: z.string().optional(), timerRunning: z.boolean().optional(), questions: z.number().int().min(0).optional(), correct: z.number().int().min(0).optional(), minutes: z.number().int().min(1).optional(), notes: z.string().max(4000).optional() });

async function context() { const session = await getServerSession(authOptions); if (!session?.user?.id) return null; const guide = await getActiveStudyGuideForUser(session.user.id); return guide ? { userId: session.user.id, guideId: guide.id } : null; }

function operationType(command: z.infer<typeof commandSchema>["command"]) { return `${command.toUpperCase()}_SESSION` as const; }

async function execute(userId: string, guideId: string, body: z.infer<typeof commandSchema>) {
  if (body.command === "start") return { session: await cycleService.start(userId, guideId, { mode: body.mode ?? "CYCLE", disciplineId: body.disciplineId, subjectId: body.subjectId, operationId: body.operationId, timerRunning: body.timerRunning }) };
  if (!body.id || body.version === undefined) throw new Error("Sessão e versão são obrigatórias.");
  if (body.command === "pause") return { session: await cycleService.pause(userId, guideId, body.id, body.version) };
  if (body.command === "resume") return { session: await cycleService.resume(userId, guideId, body.id, body.version) };
  if (body.command === "cancel") return cycleService.cancel(userId, guideId, body.id, body.version);
  if (body.questions === undefined || body.correct === undefined) throw new Error("Informe os dados da atividade estudada.");
  return cycleService.finish(userId, guideId, body.id, body.version, { questions: body.questions, correct: body.correct, minutes: body.minutes, notes: body.notes });
}

export async function GET() { const value = await context(); if (!value) return NextResponse.json({ message: "Selecione um guia ativo." }, { status: 409 }); return NextResponse.json({ session: await cycleService.getActive(value.userId, value.guideId), suggestion: await cycleService.getCurrent(value.userId, value.guideId) }); }

export async function POST(request: Request) {
  const value = await context(); if (!value) return NextResponse.json({ message: "Selecione um guia ativo." }, { status: 409 });
  const parsed = commandSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ message: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (!body.operationId) {
    try { return NextResponse.json(await execute(value.userId, value.guideId, body)); }
    catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível concluir a operação." }, { status: error instanceof CycleConflictError ? 409 : 400 }); }
  }
  const type = operationType(body.command);
  const canonicalPayload = canonicalSessionOperationPayload({ type, mode: body.mode ?? "CYCLE", disciplineId: body.disciplineId, subjectId: body.subjectId, timerRunning: body.timerRunning, sessionId: body.id, version: body.version, questions: body.questions, correct: body.correct, minutes: body.minutes, notes: body.notes });
  const claim = await claimOfflineOperation({ operationId: body.operationId, userId: value.userId, studyGuideId: value.guideId, type, payload: canonicalPayload });
  if (claim.kind === "REPLAY") return NextResponse.json({ ...(claim.response as object), idempotentReplay: true });
  if (claim.kind === "PENDING") return NextResponse.json({ operationId: body.operationId, pending: true }, { status: 202 });
  if (claim.kind === "CONFLICT") return NextResponse.json({ operationId: body.operationId, message: claim.message, conflict: true }, { status: 409 });
  try {
    const response = await execute(value.userId, value.guideId, body); await completeOfflineOperation(claim.recordId, claim.version, response); return NextResponse.json(response);
  } catch (error) {
    const conflict = error instanceof CycleConflictError; const message = error instanceof Error ? error.message : "Falha temporária.";
    await failOfflineOperation(claim.recordId, claim.version, { conflict, message });
    return NextResponse.json({ message, conflict, code: conflict ? error.code : "TEMPORARY_FAILURE" }, { status: conflict ? 409 : 503 });
  }
}
