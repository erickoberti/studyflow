import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const sessions = await prisma.studySession.findMany({
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
      "Content-Disposition": "attachment; filename=study-sessions.csv",
    },
  });
}
