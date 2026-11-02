import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GENERAL_STUDY_SUBJECT_NAME, generalStudySubjectId, initialCycleEntryId } from "@/lib/study-defaults";

async function lockGuide(tx: Prisma.TransactionClient, userId: string, studyGuideId: string) {
  const guides = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "StudyGuide" WHERE "id" = ${studyGuideId} AND "userId" = ${userId} FOR UPDATE
  `);
  if (guides.length === 0) throw new Error("Guia não encontrado nesta conta.");
}

// Call only while holding the guide lock, so concurrent additions cannot reuse a position.
async function ensureDisciplineStudy(tx: Prisma.TransactionClient, userId: string, studyGuideId: string, disciplineId: string) {
  const discipline = await tx.discipline.findFirst({ where: { id: disciplineId, userId, studyGuideId, active: true } });
  if (!discipline) return { subjects: 0, entries: 0 };

  let subject = await tx.subject.findFirst({
    where: { userId, studyGuideId, disciplineId },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  let createdSubjects = 0;
  if (!subject) {
    subject = await tx.subject.create({ data: {
      id: generalStudySubjectId(disciplineId), userId, studyGuideId, disciplineId,
      name: GENERAL_STUDY_SUBJECT_NAME, weight: 1, active: true,
    } });
    createdSubjects = 1;
  }
  // An existing subject or cycle paused by the user stays paused.
  if (!subject.active) return { subjects: createdSubjects, entries: 0 };
  const existing = await tx.cycleEntry.findFirst({ where: {
    userId, studyGuideId,
    OR: [{ disciplineId }, { disciplineId: null, subject: { disciplineId } }],
  } });
  if (existing) return { subjects: createdSubjects, entries: 0 };

  const last = await tx.cycleEntry.findFirst({ where: { userId, studyGuideId }, orderBy: { orderIndex: "desc" } });
  await tx.cycleEntry.create({ data: {
    id: initialCycleEntryId(disciplineId), userId, studyGuideId, disciplineId, subjectId: subject.id,
    orderIndex: (last?.orderIndex ?? 0) + 1, active: true,
  } });
  return { subjects: createdSubjects, entries: 1 };
}

export async function createStudyDiscipline(userId: string, studyGuideId: string, input: {
  id?: string; name: string; sortOrder: number | null; category?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await lockGuide(tx, userId, studyGuideId);
    // Offline retries must not overwrite later edits or recreate removed positions.
    if (input.id) {
      const existing = await tx.discipline.findUnique({ where: { id: input.id } });
      if (existing) {
        if (existing.userId !== userId || existing.studyGuideId !== studyGuideId) throw new Error("Disciplina pertence a outro contexto.");
        return existing;
      }
    }
    const data = { userId, studyGuideId, ...input, active: true };
    const discipline = input.id
      ? await tx.discipline.create({ data })
      : await tx.discipline.upsert({
          where: { userId_studyGuideId_name: { userId, studyGuideId, name: input.name } },
          create: data,
          update: { sortOrder: input.sortOrder, ...(input.category !== undefined ? { category: input.category } : {}), active: true },
        });
    await ensureDisciplineStudy(tx, userId, studyGuideId, discipline.id);
    return discipline;
  }, { timeout: 20_000 });
}

export async function setStudyDisciplineActive(userId: string, studyGuideId: string, disciplineId: string, active: boolean,
  details: { name?: string; category?: string | null; sortOrder?: number | null } = {}) {
  return prisma.$transaction(async (tx) => {
    await lockGuide(tx, userId, studyGuideId);
    const discipline = await tx.discipline.findFirst({ where: { id: disciplineId, userId, studyGuideId } });
    if (!discipline) return null;
    if (discipline.active === active && Object.keys(details).length === 0) return discipline;
    const reactivating = active && !discipline.active;
    const updated = await tx.discipline.update({ where: { id: disciplineId }, data: { ...details, active } });
    // Activating an old, empty discipline must make it usable just like a new one.
    if (reactivating) await ensureDisciplineStudy(tx, userId, studyGuideId, disciplineId);
    return updated;
  }, { timeout: 20_000 });
}

export async function buildStudyGuideCycle(userId: string, studyGuideId: string) {
  return prisma.$transaction(async (tx) => {
    await lockGuide(tx, userId, studyGuideId);
    // Recovery is explicit and only initializes an empty cycle; it never rebuilds one.
    if (await tx.cycleEntry.count({ where: { userId, studyGuideId } })) return { subjects: 0, entries: 0 };
    const disciplines = await tx.discipline.findMany({
      where: { userId, studyGuideId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    const created = { subjects: 0, entries: 0 };
    for (const discipline of disciplines) {
      const result = await ensureDisciplineStudy(tx, userId, studyGuideId, discipline.id);
      created.subjects += result.subjects;
      created.entries += result.entries;
    }
    return created;
  }, { timeout: 20_000 });
}
