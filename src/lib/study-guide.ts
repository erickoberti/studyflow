import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const LEGACY_GUIDE_NAME = "CAU - RJ - Especialista Adm";
export const STUDY_GUIDE_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#64748b"] as const;
export const STUDY_GUIDE_ICONS = [
  "book-open",
  "graduation-cap",
  "briefcase",
  "code-2",
  "scale",
  "flask-conical",
  "globe",
  "monitor-play",
] as const;

async function countLegacyData(userId: string) {
  const [disciplines, subjects, cycleEntries, sessions] = await Promise.all([
    prisma.discipline.count({ where: { userId, studyGuideId: null } }),
    prisma.subject.count({ where: { userId, studyGuideId: null } }),
    prisma.cycleEntry.count({ where: { userId, studyGuideId: null } }),
    prisma.studySession.count({ where: { userId, studyGuideId: null } }),
  ]);

  return disciplines + subjects + cycleEntries + sessions;
}

export async function getStudyGuideState(userId: string) {
  const [user, guides] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, activeStudyGuideId: true },
    }),
    prisma.studyGuide.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
      include: {
        _count: {
          select: {
            disciplines: true,
            subjects: true,
            cycleEntries: true,
            sessions: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    return { guides: [], activeGuide: null as (typeof guides)[number] | null };
  }

  if (guides.length === 0) {
    const legacyCount = await countLegacyData(userId);

    if (legacyCount > 0) {
      const created = await prisma.$transaction(async (tx) => {
        const legacySettings = await tx.userSettings.findUnique({
          where: { userId },
        });

        const guide = await tx.studyGuide.create({
          data: {
            userId,
            name: LEGACY_GUIDE_NAME,
            icon: "briefcase",
            color: "#6366f1",
            description: "Guia migrado a partir dos dados existentes.",
            settings: {
              create: {
                userId,
                targetPercentage: legacySettings?.targetPercentage ?? 80,
                dailyQuestionsGoal: legacySettings?.dailyQuestionsGoal ?? 30,
                weeklyQuestionsGoal: legacySettings?.weeklyQuestionsGoal ?? 200,
                weightPriorityBias: legacySettings?.weightPriorityBias ?? 1.25,
              },
            },
          },
          include: {
            _count: {
              select: {
                disciplines: true,
                subjects: true,
                cycleEntries: true,
                sessions: true,
              },
            },
          },
        });

        await Promise.all([
          tx.discipline.updateMany({
            where: { userId, studyGuideId: null },
            data: { studyGuideId: guide.id },
          }),
          tx.subject.updateMany({
            where: { userId, studyGuideId: null },
            data: { studyGuideId: guide.id },
          }),
          tx.cycleEntry.updateMany({
            where: { userId, studyGuideId: null },
            data: { studyGuideId: guide.id },
          }),
          tx.studySession.updateMany({
            where: { userId, studyGuideId: null },
            data: { studyGuideId: guide.id },
          }),
          tx.user.update({
            where: { id: userId },
            data: { activeStudyGuideId: guide.id },
          }),
        ]);

        return guide;
      });

      return { guides: [created], activeGuide: created };
    }

    return { guides: [], activeGuide: null };
  }

  let activeGuide = guides.find((guide) => guide.id === user.activeStudyGuideId) ?? null;

  if (!activeGuide && guides.length === 1) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeStudyGuideId: guides[0].id },
    });

    activeGuide = guides[0];
  }

  return { guides, activeGuide };
}

export async function getStudyGuidesWithDisciplines(userId: string) {
  const state = await getStudyGuideState(userId);

  const guideIds = state.guides.map((guide) => guide.id);
  const disciplines = guideIds.length
    ? await prisma.discipline.findMany({
        where: { userId, studyGuideId: { in: guideIds } },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: {
          _count: {
            select: {
              subjects: true,
            },
          },
        },
      })
    : [];

  return {
    ...state,
    guides: state.guides.map((guide) => ({
      ...guide,
      disciplines: disciplines.filter((discipline) => discipline.studyGuideId === guide.id),
    })),
  };
}

export async function requireActiveStudyGuide(userId: string) {
  const state = await getStudyGuideState(userId);

  if (!state.activeGuide) {
    redirect("/guias");
  }

  return state.activeGuide;
}

export async function getActiveStudyGuideForUser(userId: string) {
  const state = await getStudyGuideState(userId);
  return state.activeGuide;
}

export async function setActiveStudyGuide(userId: string, studyGuideId: string) {
  const guide = await prisma.studyGuide.findFirst({
    where: { id: studyGuideId, userId },
    select: { id: true },
  });

  if (!guide) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { activeStudyGuideId: guide.id },
  });

  return true;
}
