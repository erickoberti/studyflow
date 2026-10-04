import type { Prisma } from "@prisma/client";
import { lockSubjectsForProgress, recalculateSubjectProgress } from "@/lib/subject-progress";

export function parseDailyImportDate(value: string | undefined | null): Date | null {
  const raw = value?.trim();
  if (!raw) return null;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (brazilian || iso) {
    const year = Number(brazilian?.[3] ?? iso?.[1]);
    const month = Number(brazilian?.[2] ?? iso?.[2]);
    const day = Number(brazilian?.[1] ?? iso?.[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dailyImportDayRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

export function validDailyImportResults(questions: number, correct: number, wrong: number) {
  return [questions, correct, wrong].every((value) => Number.isInteger(value) && value >= 0) && questions > 0 && correct + wrong === questions;
}

export async function processDailyImportRecord(tx: Prisma.TransactionClient, input: {
  userId: string; studyGuideId: string; disciplineName: string; subjectName: string; weight: number;
  date: Date; questions: number; correct: number; wrong: number; percentage: number;
  estimatedMinutes: number; notes: string | null;
}): Promise<"inserted" | "updated" | "skipped" | "conflict"> {
  const { userId, studyGuideId } = input;
  const discipline = await tx.discipline.findFirst({ where: { userId, studyGuideId, name: input.disciplineName } })
    ?? await tx.discipline.create({ data: { userId, studyGuideId, name: input.disciplineName, active: true, category: null } });
  const subject = await tx.subject.findFirst({ where: { userId, studyGuideId, disciplineId: discipline.id, name: input.subjectName } })
    ?? await tx.subject.create({ data: { userId, studyGuideId, disciplineId: discipline.id, name: input.subjectName, weight: input.weight, active: true } });
  await lockSubjectsForProgress(tx, userId, studyGuideId, [subject.id]);
  const cycleEntry = await tx.cycleEntry.findFirst({ where: { userId, studyGuideId, subjectId: subject.id }, orderBy: { orderIndex: "asc" } });
  const existing = await tx.studySession.findMany({
    where: { userId, studyGuideId, date: dailyImportDayRange(input.date), OR: [{ subjectId: subject.id }, ...(cycleEntry ? [{ subjectId: null, cycleEntryId: cycleEntry.id }] : [])] },
    select: { id: true, subjectId: true, questions: true, correct: true, wrong: true },
  });
  const same = existing.find((item) => item.questions === input.questions && item.correct === input.correct && item.wrong === input.wrong);
  if (same) {
    if (!same.subjectId) {
      await tx.studySession.update({ where: { id: same.id }, data: { subjectId: subject.id } });
      await recalculateSubjectProgress(tx, userId, studyGuideId, [subject.id]);
      return "updated";
    }
    return "skipped";
  }
  if (existing.length) return "conflict";
  await tx.studySession.create({ data: { userId, studyGuideId, cycleEntryId: null, subjectId: subject.id, scope: "SUBJECT", date: input.date, questions: input.questions, correct: input.correct, wrong: input.wrong, percentage: input.percentage, estimatedMinutes: input.estimatedMinutes, notes: input.notes } });
  await recalculateSubjectProgress(tx, userId, studyGuideId, [subject.id]);
  return "inserted";
}
