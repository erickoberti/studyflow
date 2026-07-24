import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/components/forms/session-manager";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getCyclePositionSuggestions } from "@/lib/cycle-strategy";

export default async function RegistrosPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const [sessions, suggestions] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: guide.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { subject: { include: { discipline: true } }, cycleEntry: { include: { discipline: true, subject: { include: { discipline: true } } } } },
    }),
    getCyclePositionSuggestions(user.id, guide.id),
  ]);
  const safeSessions = sessions.map((item) => ({
    id: item.id, cycleEntryId: item.cycleEntryId, date: item.date.toISOString(), questions: item.questions, correct: item.correct, wrong: item.wrong,
    percentage: item.percentage, estimatedMinutes: item.estimatedMinutes, notes: item.notes ?? "",
    subjectName: item.subject?.name ?? item.cycleEntry.subject?.name ?? "Assunto legado indisponível",
    disciplineName: item.subject?.discipline.name ?? item.cycleEntry.discipline?.name ?? item.cycleEntry.subject?.discipline.name ?? "Disciplina",
  }));
  const cycleEntries = suggestions.map((item) => ({ id: item.entryId, orderIndex: item.orderIndex, subjectName: item.subject?.name ?? "Assunto sugerido indisponível", disciplineName: item.discipline }));
  return <div className="space-y-6 pb-10"><header><h1 className="text-3xl font-black text-slate-900 dark:text-white">Sessões de Estudo</h1><p className="mt-1 text-slate-500 dark:text-slate-400">Histórico usa o assunto registrado em cada sessão; o ciclo usa sugestões dinâmicas.</p></header><SessionManager sessions={safeSessions} cycleEntries={cycleEntries} /></div>;
}
