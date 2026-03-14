import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const sessions = await prisma.studySession.findMany({
    where: { userId: session.user.id, studyGuideId: guide.id },
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
    orderBy: { date: "desc" },
  });

  const csv = Papa.unparse(
    sessions.map((row) => ({
      data: row.date.toISOString().slice(0, 10),
      disciplina: row.cycleEntry.subject.discipline.name,
      assunto: row.cycleEntry.subject.name,
      peso: row.cycleEntry.subject.weight,
      questoes: row.questions,
      acertos: row.correct,
      erros: row.wrong,
      percentual: row.percentage.toFixed(2),
      observacoes: row.notes ?? "",
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${guide.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-sessions.csv"`,
    },
  });
}
