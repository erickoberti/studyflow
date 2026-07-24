/**
 * Backwards-compatible façade. New consumers must use cycleService directly.
 * `CycleEntry.subjectId` is deliberately not used to determine a live position;
 * it is retained only as a historical-data compatibility relation.
 */
import { Prisma } from "@prisma/client";
import { cycleService } from "@/lib/cycle-service";

export type CycleSuggestion = Awaited<ReturnType<typeof cycleService.getCurrent>>;
export const getCycleSuggestion = (userId: string, studyGuideId: string) => cycleService.getCurrent(userId, studyGuideId);

export async function getCyclePositionSuggestions(userId: string, studyGuideId: string) {
  const all = await cycleService.preview(userId, studyGuideId, 200);
  return all.map((item) => ({ entryId: item.entryId, orderIndex: item.orderIndex, discipline: item.discipline.name, questionGoal: item.discipline.questionGoal, subject: item.subject }));
}

/** @deprecated Session completion is now atomically performed by CycleService.finish. */
export async function completeCycleSession(_tx: Prisma.TransactionClient, input: { userId: string; studyGuideId: string; cycleEntryId: string; subjectId: string; date: Date; questions: number; correct: number; wrong: number }) {
  const active = await cycleService.start(input.userId, input.studyGuideId, { mode: "CYCLE" });
  if (!active || active.cycle?.entryId !== input.cycleEntryId || active.subject.id !== input.subjectId) throw new Error("A sessão não corresponde ao próximo item do ciclo.");
  return cycleService.finish(input.userId, input.studyGuideId, active.id, active.version, { questions: input.questions, correct: input.correct, minutes: 0 });
}
