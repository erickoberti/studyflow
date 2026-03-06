import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  date: z.string(),
  cycleEntryId: z.string().min(1),
  questions: z.number().int().min(1),
  correct: z.number().int().min(0),
  wrong: z.number().int().min(0),
  notes: z.string().optional().nullable(),
  estimatedMinutes: z.number().int().min(0).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const data = await prisma.studySession.findMany({
    where: { userId: session.user.id },
    include: {
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
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos" }, { status: 400 });
  }

  const { date, cycleEntryId, questions, correct, wrong, notes, estimatedMinutes } = parsed.data;

  if (correct + wrong !== questions) {
    return NextResponse.json({ message: "Questoes deve ser acertos + erros" }, { status: 400 });
  }

  const cycleEntry = await prisma.cycleEntry.findFirst({
    where: {
      id: cycleEntryId,
      userId: session.user.id,
    },
  });

  if (!cycleEntry) {
    return NextResponse.json({ message: "Entrada de ciclo nao encontrada" }, { status: 404 });
  }

  const created = await prisma.studySession.create({
    data: {
      userId: session.user.id,
      cycleEntryId,
      date: new Date(date),
      questions,
      correct,
      wrong,
      percentage: questions > 0 ? (correct / questions) * 100 : 0,
      estimatedMinutes: estimatedMinutes ?? Math.round(questions * 1.5),
      notes,
    },
  });

  return NextResponse.json(created, { status: 201 });
}