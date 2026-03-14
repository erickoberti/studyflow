import { prisma } from "@/lib/prisma";

export async function ensureStudyGuideSettings(userId: string, studyGuideId: string) {
  const existing = await prisma.studyGuideSettings.findUnique({
    where: { studyGuideId },
  });

  if (existing) return existing;

  const legacy = await prisma.userSettings.findUnique({
    where: { userId },
  });

  return prisma.studyGuideSettings.create({
    data: {
      userId,
      studyGuideId,
      targetPercentage: legacy?.targetPercentage ?? 80,
      dailyQuestionsGoal: legacy?.dailyQuestionsGoal ?? 30,
      weeklyQuestionsGoal: legacy?.weeklyQuestionsGoal ?? 200,
      weightPriorityBias: legacy?.weightPriorityBias ?? 1.25,
    },
  });
}

export async function getStudyGuideSettings(userId: string, studyGuideId: string) {
  return ensureStudyGuideSettings(userId, studyGuideId);
}
