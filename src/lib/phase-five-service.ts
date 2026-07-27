import { prisma } from "@/lib/prisma";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { buildExamPlan, buildExplainableRecommendations, distributeQuestionsByWeight } from "@/lib/phase-five";

export async function getPhaseFiveData(userId: string, studyGuideId: string) {
  const [disciplines, exams, settings] = await Promise.all([
    prisma.discipline.findMany({
      where: { userId, studyGuideId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subjects: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { progress: true, syllabusProgress: true },
        },
      },
    }),
    prisma.mockExam.findMany({
      where: { userId, studyGuideId },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      include: { results: { include: { discipline: { select: { name: true } } }, orderBy: { discipline: { name: "asc" } } } },
    }),
    getStudyGuideSettings(userId, studyGuideId),
  ]);

  const weightedDisciplines = disciplines.map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
    weight: Math.max(1, discipline.subjects.reduce((sum, subject) => sum + Math.max(1, subject.weight), 0)),
  }));
  const subjects = disciplines.flatMap((discipline) => discipline.subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    weight: subject.weight,
    discipline: { id: discipline.id, name: discipline.name },
    progress: subject.progress,
    syllabusStatus: subject.syllabusProgress?.status ?? "NOT_STARTED" as const,
    syllabusNotes: subject.syllabusProgress?.notes ?? null,
  })));
  const completedSubjects = subjects.filter((item) => item.syllabusStatus === "COMPLETED").length;
  const inProgressSubjects = subjects.filter((item) => item.syllabusStatus === "IN_PROGRESS").length;
  const plan = buildExamPlan({
    now: new Date(),
    examDate: settings.examDate,
    totalSubjects: subjects.length,
    completedSubjects,
    inProgressSubjects,
    weeklyQuestionsGoal: settings.weeklyQuestionsGoal,
    sessionMinutes: settings.sessionMinutes,
    questionsPerSession: settings.questionsPerSession,
  });
  const recommendations = buildExplainableRecommendations(subjects.map((item) => ({
    subjectId: item.id,
    subject: item.name,
    discipline: item.discipline.name,
    weight: item.weight,
    status: item.syllabusStatus,
    percentage: item.progress?.averagePercentage ?? 0,
    passages: item.progress?.passages ?? 0,
    lastStudiedAt: item.progress?.lastStudiedAt ?? null,
  })));
  const averageExamScore = exams.length ? exams.reduce((sum, exam) => sum + exam.percentage, 0) / exams.length : 0;

  return {
    disciplines,
    weightedDisciplines,
    suggestedDistribution: distributeQuestionsByWeight(100, weightedDisciplines),
    subjects,
    exams,
    plan,
    recommendations,
    summary: {
      totalExams: exams.length,
      averageExamScore,
      bestExamScore: exams.length ? Math.max(...exams.map((exam) => exam.percentage)) : 0,
      lastExamScore: exams[0]?.percentage ?? null,
      completedSubjects,
      inProgressSubjects,
      totalSubjects: subjects.length,
    },
  };
}

export async function getPhaseFiveDashboard(userId: string, studyGuideId: string) {
  const data = await getPhaseFiveData(userId, studyGuideId);
  return { summary: data.summary, plan: data.plan, recommendations: data.recommendations.slice(0, 3), latestExam: data.exams[0] ?? null };
}
