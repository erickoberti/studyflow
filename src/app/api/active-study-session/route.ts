import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { cycleService } from "@/lib/cycle-service";

const commandSchema = z.object({ command: z.enum(["start", "pause", "resume", "cancel", "finish"]), id: z.string().optional(), version: z.number().int().optional(), mode: z.enum(["CYCLE", "AVULSO"]).optional(), disciplineId: z.string().optional(), subjectId: z.string().optional(), questions: z.number().int().min(1).optional(), correct: z.number().int().min(0).optional(), minutes: z.number().int().min(0).optional(), notes: z.string().max(4000).optional() });

async function context() {
  const session = await getServerSession(authOptions); if (!session?.user?.id) return null;
  const guide = await getActiveStudyGuideForUser(session.user.id); return guide ? { userId: session.user.id, guideId: guide.id } : null;
}

export async function GET() {
  const value = await context(); if (!value) return NextResponse.json({ message: "Selecione um guia ativo." }, { status: 409 });
  return NextResponse.json({ session: await cycleService.getActive(value.userId, value.guideId), suggestion: await cycleService.getCurrent(value.userId, value.guideId) });
}

export async function POST(request: Request) {
  const value = await context(); if (!value) return NextResponse.json({ message: "Selecione um guia ativo." }, { status: 409 });
  const parsed = commandSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ message: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const body = parsed.data;
    if (body.command === "start") return NextResponse.json({ session: await cycleService.start(value.userId, value.guideId, { mode: body.mode ?? "CYCLE", disciplineId: body.disciplineId, subjectId: body.subjectId }) });
    if (!body.id || body.version === undefined) return NextResponse.json({ message: "Sessão e versão são obrigatórias." }, { status: 400 });
    if (body.command === "pause") return NextResponse.json({ session: await cycleService.pause(value.userId, value.guideId, body.id, body.version) });
    if (body.command === "resume") return NextResponse.json({ session: await cycleService.resume(value.userId, value.guideId, body.id, body.version) });
    if (body.command === "cancel") return NextResponse.json(await cycleService.cancel(value.userId, value.guideId, body.id, body.version));
    if (body.questions === undefined || body.correct === undefined) return NextResponse.json({ message: "Informe acertos e erros." }, { status: 400 });
    return NextResponse.json(await cycleService.finish(value.userId, value.guideId, body.id, body.version, { questions: body.questions, correct: body.correct, minutes: body.minutes, notes: body.notes }));
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível concluir a operação." }, { status: 409 }); }
}
