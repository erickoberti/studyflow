import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const sessions = await prisma.studySession.findMany({
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
    orderBy: { date: "desc" },
  });

  const csv = Papa.unparse(
    sessions.map((row) => ({
      data: row.date.toISOString().slice(0, 10),
      escopo: row.scope,
      atividade: row.activityType,
      disciplina: row.scope === "GENERAL" ? "Todas as matérias" : row.subject?.discipline.name ?? row.cycleEntry?.subject?.discipline.name ?? "",
      assunto: row.scope === "GENERAL" ? "Revisão geral" : row.subject?.name ?? row.cycleEntry?.subject?.name ?? "",
      peso: row.subject?.weight ?? row.cycleEntry?.subject?.weight ?? 0,
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
