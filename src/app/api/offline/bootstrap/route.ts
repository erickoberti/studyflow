import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { cycleService } from "@/lib/cycle-service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const [user, guides, activeGuide] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, activeStudyGuideId: true },
    }),
    prisma.studyGuide.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, icon: true, color: true, description: true },
    }),
    getActiveStudyGuideForUser(session.user.id),
  ]);

  if (!user) {
    return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });
  }

  if (!activeGuide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const [settings, disciplines, subjects, cycleEntries, sessions, cycleState] = await Promise.all([
    getStudyGuideSettings(user.id, activeGuide.id),
    prisma.discipline.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: [{ name: "asc" }],
      select: { id: true, studyGuideId: true, name: true, category: true, sortOrder: true, active: true },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: [{ name: "asc" }],
      select: { id: true, studyGuideId: true, disciplineId: true, name: true, weight: true, notes: true, tecReference: true, active: true },
    }),
    prisma.cycleEntry.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: { orderIndex: "asc" },
      select: { id: true, studyGuideId: true, subjectId: true, orderIndex: true, active: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: activeGuide.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { id: true, cycleEntryId: true, subjectId: true, scope: true, date: true, questions: true, correct: true, wrong: true, percentage: true, estimatedMinutes: true, activityType: true, notes: true, createdAt: true, updatedAt: true },
    }),
    prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: activeGuide.id }, select: { currentOrderIndex: true } }),
  ]);
  const cycleSuggestions = cycleEntries.length ? await cycleService.preview(user.id, activeGuide.id, cycleEntries.length) : [];
  const suggestedSubjectByEntry = new Map(cycleSuggestions.map((item) => [item.entryId, item.subject.id]));

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
    cycleCursor: { guideId: activeGuide.id, currentOrderIndex: cycleState?.currentOrderIndex ?? 1 },
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
      subjectId: suggestedSubjectByEntry.get(entry.id) ?? entry.subjectId ?? "",
      orderIndex: entry.orderIndex,
      active: entry.active,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      cycleEntryId: session.cycleEntryId,
      subjectId: session.subjectId,
      scope: session.scope,
      date: session.date.toISOString(),
      questions: session.questions,
      correct: session.correct,
      wrong: session.wrong,
      percentage: session.percentage,
      estimatedMinutes: session.estimatedMinutes,
      activityType: session.activityType,
      notes: session.notes,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
  });
}
