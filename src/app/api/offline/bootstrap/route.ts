import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const [user, guides, activeGuide] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, activeStudyGuideId: true },
    }),
    prisma.studyGuide.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, icon: true, color: true },
    }),
    getActiveStudyGuideForUser(session.user.id),
  ]);

  if (!user) {
    return NextResponse.json({ message: "Usuario nao encontrado" }, { status: 404 });
  }

  if (!activeGuide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const [settings, disciplines, subjects, cycleEntries, sessions] = await Promise.all([
    getStudyGuideSettings(user.id, activeGuide.id),
    prisma.discipline.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: [{ name: "asc" }],
    }),
    prisma.subject.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: [{ name: "asc" }],
    }),
    prisma.cycleEntry.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    guides: guides.map((guide) => ({
      ...guide,
      serverId: guide.id,
    })),
    activeGuideId: activeGuide.id,
    settings,
    disciplines: disciplines.map((discipline) => ({
      id: discipline.id,
      serverId: discipline.id,
      guideId: discipline.studyGuideId ?? activeGuide.id,
      name: discipline.name,
      category: discipline.category,
      sortOrder: discipline.sortOrder,
      active: discipline.active,
    })),
    subjects: subjects.map((subject) => ({
      id: subject.id,
      serverId: subject.id,
      guideId: subject.studyGuideId ?? activeGuide.id,
      disciplineId: subject.disciplineId,
      name: subject.name,
      weight: subject.weight,
      notes: subject.notes,
      tecReference: subject.tecReference,
      active: subject.active,
      orderIndex: cycleEntries.find((entry) => entry.subjectId === subject.id)?.orderIndex ?? null,
    })),
    cycleEntries: cycleEntries.map((entry) => ({
      id: entry.id,
      serverId: entry.id,
      guideId: entry.studyGuideId ?? activeGuide.id,
      subjectId: entry.subjectId,
      orderIndex: entry.orderIndex,
      active: entry.active,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      cycleEntryId: session.cycleEntryId,
      date: session.date.toISOString(),
      questions: session.questions,
      correct: session.correct,
      wrong: session.wrong,
      percentage: session.percentage,
      estimatedMinutes: session.estimatedMinutes,
      notes: session.notes,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
  });
}
