import { Prisma } from "@prisma/client";
import { DATAPREV_2026_CYCLE, DATAPREV_2026_SUBJECTS, defaultQuestionGoal } from "@/lib/dataprev-2026";
import { prisma } from "@/lib/prisma";

/** Creates or reconciles the DATAPREV guide without touching other guides. */
export async function ensureDataprev2026Guide(userId: string) {
  return prisma.$transaction(async (tx) => {
    const guide = await tx.studyGuide.upsert({
      where: { userId_name: { userId, name: "DATAPREV 2026" } },
      create: { userId, name: "DATAPREV 2026", description: "Plano definitivo de estudos para o concurso DATAPREV.", icon: "code-2", color: "#3b82f6" },
      update: { description: "Plano definitivo de estudos para o concurso DATAPREV.", icon: "code-2", color: "#3b82f6" },
    });
    const disciplines = new Map<string, { id: string }>();
    for (const [index, name] of Object.keys(DATAPREV_2026_SUBJECTS).entries()) {
      const discipline = await tx.discipline.upsert({
        where: { userId_studyGuideId_name: { userId, studyGuideId: guide.id, name } },
        create: { userId, studyGuideId: guide.id, name, sortOrder: index + 1, questionGoal: defaultQuestionGoal(name), active: true },
        update: { sortOrder: index + 1, questionGoal: defaultQuestionGoal(name), active: true },
      });
      disciplines.set(name, discipline);
      for (const [subjectIndex, [subjectName, weight, tecReference]] of DATAPREV_2026_SUBJECTS[name].entries()) {
        await tx.subject.upsert({
          where: { userId_studyGuideId_disciplineId_name: { userId, studyGuideId: guide.id, disciplineId: discipline.id, name: subjectName } },
          create: { userId, studyGuideId: guide.id, disciplineId: discipline.id, name: subjectName, weight, tecReference, sortOrder: subjectIndex + 1, active: true },
          update: { weight, tecReference, sortOrder: subjectIndex + 1, active: true },
        });
      }
    }
    for (const [index, disciplineName] of DATAPREV_2026_CYCLE.entries()) {
      const discipline = disciplines.get(disciplineName);
      if (!discipline) throw new Error(`Disciplina DATAPREV ausente: ${disciplineName}`);
      await tx.cycleEntry.upsert({
        where: { userId_studyGuideId_orderIndex: { userId, studyGuideId: guide.id, orderIndex: index + 1 } },
        create: { userId, studyGuideId: guide.id, disciplineId: discipline.id, orderIndex: index + 1, active: true },
        update: { disciplineId: discipline.id, subjectId: null, active: true },
      });
    }
    await tx.studyGuideSettings.upsert({
      where: { studyGuideId: guide.id },
      create: { userId, studyGuideId: guide.id, organizer: "DATAPREV", role: "Tecnologia da Informação", cycleAlgorithm: "weighted_round_robin", sessionMinutes: 60, questionsPerSession: 20 },
      update: { organizer: "DATAPREV", role: "Tecnologia da Informação", cycleAlgorithm: "weighted_round_robin" },
    });
    await tx.studyGuideCycleState.upsert({ where: { studyGuideId: guide.id }, create: { userId, studyGuideId: guide.id }, update: {} });
    return guide;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
