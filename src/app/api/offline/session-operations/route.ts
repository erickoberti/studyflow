import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { cycleService } from "@/lib/cycle-service";

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

function notes(payload: z.infer<typeof payloadSchema>) {
  return [payload.difficulty ? `[${payload.difficulty}]` : "", payload.notes?.trim() ?? ""].filter(Boolean).join(" ") || undefined;
}

export async function POST(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  const parsed = operationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Operação offline inválida.", issues: parsed.error.flatten() }, { status: 400 });
  const operation = parsed.data;
  if (operation.userId !== auth.user.id) return NextResponse.json({ message: "A operação pertence a outro usuário." }, { status: 403 });

  try {
    const payload = operation.payload;
    if (operation.type === "START_SESSION") {
      const session = await cycleService.start(auth.user.id, operation.studyGuideId, { mode: payload.mode, disciplineId: payload.disciplineId, subjectId: payload.subjectId, operationId: operation.operationId });
      return NextResponse.json({ operationId: operation.operationId, session });
    }
    if (operation.type === "CREATE_STANDALONE_SESSION") {
      if (!payload.subjectId) return NextResponse.json({ message: "O estudo avulso exige subjectId." }, { status: 400 });
      const active = await cycleService.start(auth.user.id, operation.studyGuideId, { mode: "AVULSO", disciplineId: payload.disciplineId, subjectId: payload.subjectId, operationId: operation.operationId });
      if (!active) throw new Error("Não foi possível criar a sessão avulsa.");
      if (active.id !== operation.operationId && (active.mode !== "AVULSO" || active.subject.id !== payload.subjectId)) {
        return NextResponse.json({ message: "Existe outra sessão ativa no servidor; o estudo avulso foi preservado para reconciliação." }, { status: 409 });
      }
      const result = await cycleService.finish(auth.user.id, operation.studyGuideId, active.id, active.version, { questions: payload.questions, correct: payload.correct, minutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), notes: notes(payload) });
      return NextResponse.json({ operationId: operation.operationId, serverSessionId: active.id, version: active.version, ...result });
    }
    const id = payload.serverSessionId;
    const version = payload.serverVersion;
    if (!id || version === null) return NextResponse.json({ message: "A sessão ainda precisa ser iniciada no servidor." }, { status: 409 });
    if (operation.type === "PAUSE_SESSION") return NextResponse.json({ operationId: operation.operationId, session: await cycleService.pause(auth.user.id, operation.studyGuideId, id, version) });
    if (operation.type === "RESUME_SESSION") return NextResponse.json({ operationId: operation.operationId, session: await cycleService.resume(auth.user.id, operation.studyGuideId, id, version) });
    if (operation.type === "CANCEL_SESSION") return NextResponse.json({ operationId: operation.operationId, ...(await cycleService.cancel(auth.user.id, operation.studyGuideId, id, version)) });
    if (payload.questions <= 0 || payload.correct + payload.wrong !== payload.questions) return NextResponse.json({ message: "A finalização exige ao menos uma questão e total consistente." }, { status: 400 });
    const result = await cycleService.finish(auth.user.id, operation.studyGuideId, id, version, { questions: payload.questions, correct: payload.correct, minutes: Math.max(1, Math.round(payload.accumulatedSeconds / 60)), notes: notes(payload) });
    return NextResponse.json({ operationId: operation.operationId, ...result });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível sincronizar a operação." }, { status: 409 });
  }
}
