import { prisma } from "@/lib/prisma";

type GuideSettingsShape = {
  id?: string;
  userId: string;
  studyGuideId: string;
  targetPercentage: number;
  dailyQuestionsGoal: number;
  weeklyQuestionsGoal: number;
  weightPriorityBias: number;
};

function legacyDefaults(legacy?: {
  targetPercentage?: number;
  dailyQuestionsGoal?: number;
  weeklyQuestionsGoal?: number;
  weightPriorityBias?: number;
} | null) {
  return {
    targetPercentage: legacy?.targetPercentage ?? 80,
    dailyQuestionsGoal: legacy?.dailyQuestionsGoal ?? 30,
    weeklyQuestionsGoal: legacy?.weeklyQuestionsGoal ?? 200,
    weightPriorityBias: legacy?.weightPriorityBias ?? 1.25,
  };
}

function getGuideSettingsDelegate() {
  return (prisma as unknown as { studyGuideSettings?: {
    findUnique: (args: unknown) => Promise<GuideSettingsShape | null>;
    create: (args: unknown) => Promise<GuideSettingsShape>;
    upsert: (args: unknown) => Promise<GuideSettingsShape>;
    findMany: (args: unknown) => Promise<GuideSettingsShape[]>;
  } }).studyGuideSettings;
}

export async function ensureStudyGuideSettings(userId: string, studyGuideId: string): Promise<GuideSettingsShape> {
  const delegate = getGuideSettingsDelegate();
  const legacy = await prisma.userSettings.findUnique({
    where: { userId },
  });
  const defaults = legacyDefaults(legacy);

  if (!delegate) {
    return {
      userId,
      studyGuideId,
      ...defaults,
    };
  }

  const existing = await delegate.findUnique({
    where: { studyGuideId },
  });

  if (existing) return existing;

  return delegate.create({
    data: {
      userId,
      studyGuideId,
      ...defaults,
    },
  });
}

export async function upsertStudyGuideSettings(
  userId: string,
  studyGuideId: string,
  values: {
    targetPercentage: number;
    dailyQuestionsGoal: number;
    weeklyQuestionsGoal: number;
    weightPriorityBias: number;
  },
) {
  const delegate = getGuideSettingsDelegate();
  if (!delegate) {
    return {
      userId,
      studyGuideId,
      ...values,
    };
  }

  return delegate.upsert({
    where: { studyGuideId },
    create: {
      userId,
      studyGuideId,
      ...values,
    },
    update: values,
  });
}

export async function getStudyGuideSettings(userId: string, studyGuideId: string) {
  return ensureStudyGuideSettings(userId, studyGuideId);
}

export async function getAllStudyGuideSettings(userId: string) {
  const delegate = getGuideSettingsDelegate();
  if (!delegate) return [];
  return delegate.findMany({
    where: { userId },
  });
}
