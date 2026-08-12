import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { createStandaloneStudySession } from "@/lib/standalone-study-session";

const standaloneCreateSchema = z.object({
  studyGuideId: z.string().min(1),
  disciplineId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  correct: z.number().int().min(0),
  wrong: z.number().int().min(0),
  estimatedMinutes: z.number().int().min(1),
  activityType: z.enum(["QUESTIONS", "CLASS", "READING", "PDF_READING", "REVIEW"]).optional(),
  difficulty: z.enum(["Fácil", "Média", "Difícil"]),
  notes: z.string().max(4000).optional().nullable(),
});

const legacySessionSchema = z.object({
  date: z.string(),
  cycleEntryId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  questions: z.number().int().min(0),
  correct: z.number().int().min(0),
  wrong: z.number().int().min(0),
  notes: z.string().optional().nullable(),
  estimatedMinutes: z.number().int().min(0).optional(),
  activityType: z.enum(["QUESTIONS", "CLASS", "READING", "PDF_READING", "REVIEW"]).optional(),
});

const updateSchema = legacySessionSchema.extend({
  id: z.string().min(1),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const data = await prisma.studySession.findMany({
    where: { userId: session.user.id, studyGuideId: guide.id },
    include: {
      subject: { include: { discipline: true } },
      cycleEntry: {
        include: {
          subject: {
            include: {
              discipline: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  const payload = await request.json().catch(() => null);
  const parsed = standaloneCreateSchema.safeParse(payload);
  if (parsed.success) {
    try {
      const created = await prisma.$transaction((tx) => createStandaloneStudySession(tx, { userId: session.user.id, ...parsed.data }));
      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível salvar o estudo avulso." }, { status: 400 });
    }
  }

  // Compatibilidade com registros offline legados ainda presentes no dispositivo.
  const legacy = legacySessionSchema.safeParse(payload);
  if (!legacy.success) return NextResponse.json({ message: "Preencha guia, disciplina, assunto, data, horário e resultados corretamente.", issues: parsed.error.flatten() }, { status: 400 });
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  const { date, cycleEntryId, subjectId, questions, correct, wrong, notes, estimatedMinutes, activityType } = legacy.data;
  if (correct + wrong !== questions) return NextResponse.json({ message: "Questões deve ser acertos + erros" }, { status: 400 });
  const entry = await prisma.cycleEntry.findFirst({ where: { id: cycleEntryId, userId: session.user.id, studyGuideId: guide.id } });
  if (!entry || !subjectId) return NextResponse.json({ message: "O registro offline legado não possui posição ou assunto válido." }, { status: 400 });
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId: session.user.id, studyGuideId: guide.id, disciplineId: entry.disciplineId ?? undefined, active: true } });
  if (!subject) return NextResponse.json({ message: "O assunto do registro offline não pertence ao guia ativo." }, { status: 400 });
  const created = await prisma.studySession.create({ data: { userId: session.user.id, studyGuideId: guide.id, cycleEntryId: entry.id, subjectId: subject.id, cyclePosition: null, cycleRound: null, date: new Date(`${date}T12:00:00-03:00`), questions, correct, wrong, percentage: questions ? correct / questions * 100 : 0, estimatedMinutes: estimatedMinutes ?? Math.max(1, Math.round(questions * 1.5)), activityType: activityType ?? "QUESTIONS", notes } });
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const payload = await request.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const { id, date, cycleEntryId, questions, correct, wrong, notes, estimatedMinutes, activityType } = parsed.data;

  if (correct + wrong !== questions) {
    return NextResponse.json({ message: "Questões deve ser igual a acertos + erros" }, { status: 400 });
  }

  const existing = await prisma.studySession.findFirst({
    where: { id, userId: session.user.id, studyGuideId: guide.id },
  });

  if (!existing) {
    return NextResponse.json({ message: "Registro não encontrado" }, { status: 404 });
  }

  const cycleEntry = await prisma.cycleEntry.findFirst({
    where: {
      id: cycleEntryId,
      userId: session.user.id,
      studyGuideId: guide.id,
    },
  });

  if (!cycleEntry) {
    return NextResponse.json({ message: "Entrada de ciclo não encontrada" }, { status: 404 });
  }

  const updated = await prisma.studySession.update({
    where: { id },
    data: {
      cycleEntryId,
      date: new Date(`${date}T12:00:00-03:00`),
      questions,
      correct,
      wrong,
      percentage: questions > 0 ? (correct / questions) * 100 : 0,
      estimatedMinutes: estimatedMinutes ?? Math.round(questions * 1.5),
      activityType: activityType ?? existing.activityType,
      notes,
    },
  });

  return NextResponse.json(updated, { status: 200 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const payload = await request.json();
  const parsed = deleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.studySession.findFirst({
    where: { id: parsed.data.id, userId: session.user.id, studyGuideId: guide.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Registro não encontrado" }, { status: 404 });
  }

  await prisma.studySession.delete({
    where: { id: existing.id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
