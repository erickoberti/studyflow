import { Prisma } from "@prisma/client";

// Call after locking the discipline's subjects in the enclosing transaction.
// Group equal increments so saving does not issue one upsert per subject.
export async function advanceSubjectWeights(
  tx: Prisma.TransactionClient,
  userId: string,
  studyGuideId: string,
  subjects: Array<{ id: string; weight: number }>,
  selectedId: string,
) {
  if (!subjects.length) return;
  await tx.subjectProgress.createMany({
    data: subjects.map((subject) => ({ userId, studyGuideId, subjectId: subject.id })),
    skipDuplicates: true,
  });
  const totalWeight = subjects.reduce((sum, subject) => sum + subject.weight, 0);
  const groups = new Map<number, string[]>();
  for (const subject of subjects) {
    const increment = subject.weight - (subject.id === selectedId ? totalWeight : 0);
    const group = groups.get(increment) ?? [];
    group.push(subject.id);
    groups.set(increment, group);
  }
  for (const [increment, subjectIds] of groups) {
    if (increment === 0) continue;
    await tx.subjectProgress.updateMany({
      where: { userId, studyGuideId, subjectId: { in: subjectIds } },
      data: { currentWeight: { increment } },
    });
  }
}

export async function lockSubjectsForProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  studyGuideId: string,
  subjectIds: string[],
) {
  const ids = [...new Set(subjectIds.filter(Boolean))].sort();
  if (!ids.length) return [];
  return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "Subject"
    WHERE "userId" = ${userId} AND "studyGuideId" = ${studyGuideId}
      AND "id" IN (${Prisma.join(ids)})
    ORDER BY "id" FOR UPDATE
  `);
}

export async function recalculateSubjectProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  studyGuideId: string,
  subjectIds: string[],
) {
  const ids = [...new Set(subjectIds.filter(Boolean))];
  if (!ids.length) return;
  const subjects = await lockSubjectsForProgress(tx, userId, studyGuideId, ids);
  const aggregates = await tx.studySession.groupBy({
    by: ["subjectId"],
    where: { userId, studyGuideId, subjectId: { in: subjects.map((subject) => subject.id) } },
    _count: { id: true },
    _sum: { questions: true, correct: true, wrong: true },
    _max: { date: true },
  });
  const bySubject = new Map(aggregates.map((item) => [item.subjectId, item]));
  for (const subject of subjects) {
    const aggregate = bySubject.get(subject.id);
    const totalQuestions = aggregate?._sum.questions ?? 0;
    const correct = aggregate?._sum.correct ?? 0;
    const data = {
      passages: aggregate?._count.id ?? 0,
      totalQuestions,
      correct,
      wrong: aggregate?._sum.wrong ?? 0,
      averagePercentage: totalQuestions ? correct / totalQuestions * 100 : 0,
      lastStudiedAt: aggregate?._max.date ?? null,
    };
    await tx.subjectProgress.upsert({
      where: { subjectId: subject.id },
      create: { userId, studyGuideId, subjectId: subject.id, ...data },
      update: data,
    });
  }
}
