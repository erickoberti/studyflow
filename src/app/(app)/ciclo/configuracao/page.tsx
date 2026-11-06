import { requireUser } from "@/lib/auth";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { prisma } from "@/lib/prisma";
import { defaultProgramRows, legacyCycleFingerprint, matchingMatter, type ProgramRow } from "@/lib/programmed-cycle";
import { getCycleProgram } from "@/lib/programmed-cycle-service";
import { CycleProgramEditor } from "@/components/cycle-program-editor";

export default async function CycleConfigurationPage() {
  const user = await requireUser(); const guide = await requireActiveStudyGuide(user.id);
  const [program, entries, state, sessions, disciplines] = await Promise.all([
    getCycleProgram(user.id, guide.id),
    prisma.cycleEntry.findMany({ where: { userId: user.id, studyGuideId: guide.id }, include: { discipline: true, subject: true }, orderBy: { orderIndex: "asc" } }),
    prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: guide.id } }),
    prisma.studySession.findMany({ where: { userId: user.id, studyGuideId: guide.id }, orderBy: { date: "desc" } }),
    prisma.discipline.findMany({ where: { userId: user.id, studyGuideId: guide.id } }),
  ]);
  const rows: ProgramRow[] = program ? entries.map(entry => {
    const items = program.items.filter(item => item.entryId === entry.id);
    return { position: entry.orderIndex, matter: items[0].discipline.name, questionGoal: items[0].questionGoal, topics: items.map(item => ({ name: item.subject.name, tecDiscipline: item.tecDiscipline ?? "", tecTopic: item.tecTopic ?? "", tecUrl: item.tecUrl ?? "", tecStatus: item.tecStatus === "CONFIRMED" ? "CONFIRMED" : "SUGGESTED" })) };
  }) : defaultProgramRows().map(row => ({ ...row, matter: matchingMatter(row.matter, disciplines)?.name ?? row.matter }));
  return <CycleProgramEditor key={`${guide.id}:${program?.version ?? 0}`} legacyFingerprint={legacyCycleFingerprint(entries, state)} initialRows={rows} version={program?.version ?? 0} currentRound={program?.currentRound ?? 1} cursor={state?.currentOrderIndex ?? 1} initialRound={program?.initialRound ?? state?.roundNumber ?? 1} isFinished={program?.status === "COMPLETED"} completed={program?.items.filter(item => item.completion).map(item => `${item.entry.orderIndex}:${item.roundNumber}`) ?? []} legacyEntries={entries.map(entry => ({ position: entry.orderIndex, matter: entry.discipline?.name ?? "Matéria", subjects: entry.subject?.name ?? "Seleção atual por peso", sessionCount: sessions.filter(session => session.cycleEntryId === entry.id).length, creditCandidates: sessions.filter(session => session.cycleEntryId === entry.id && session.cyclePosition === entry.orderIndex && session.scope === "CYCLE" && !session.programItemId).map(session => ({ id: session.id, label: `${session.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${session.questions} questões · ${session.percentage.toFixed(0)}%${session.cycleRound === null ? " · volta não informada" : ` · volta antiga ${session.cycleRound}`}` })) }))} />;
}
