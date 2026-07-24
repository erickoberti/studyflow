import Link from "next/link";
import { StudySessionForm } from "@/components/forms/study-session-form";
import { ActiveStudyPanel } from "@/components/study/active-study-panel";
import { requireUser } from "@/lib/auth";
import { getCyclePositionSuggestions } from "@/lib/cycle-strategy";
import { cycleService } from "@/lib/cycle-service";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";

export default async function RegistroPage({ searchParams }: { searchParams?: { novo?: string } }) {
  const user = await requireUser(); const guide = await requireActiveStudyGuide(user.id);
  const [current, previews, recentSessions, settings, active] = await Promise.all([
    cycleService.getCurrent(user.id, guide.id), getCyclePositionSuggestions(user.id, guide.id),
    prisma.studySession.findMany({ where: { userId: user.id, studyGuideId: guide.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5, include: { subject: { include: { discipline: true } }, cycleEntry: { include: { discipline: true } } } }),
    getStudyGuideSettings(user.id, guide.id), cycleService.getActive(user.id, guide.id),
  ]);
  const entries = previews.map((item) => ({ id: item.entryId, orderIndex: item.orderIndex, active: true, subject: { name: item.subject?.name ?? "Sem assunto", weight: item.subject?.weight ?? 1, notes: null, tecReference: null, discipline: { name: item.discipline } } }));
  const sessions = recentSessions.map((session) => ({ ...session, subjectName: session.subject?.name ?? "Assunto legado indisponível", disciplineName: session.subject?.discipline.name ?? session.cycleEntry.discipline?.name ?? "Disciplina" }));
  return <div className="space-y-5 pb-20 lg:pb-0"><header className="flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Estudar</h1><p className="mt-1 text-slate-500">O modo ciclo é automático; o registro manual é sempre avulso.</p></div><Link href="/registros" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary">Ver sessões</Link></header><ActiveStudyPanel initialActive={active as never} suggestion={current as never} />
    {searchParams?.novo === "1" ? <section><p className="mb-3 text-sm font-bold text-slate-600 dark:text-slate-300">Registro avulso — não altera o cursor do ciclo.</p><StudySessionForm cycleEntries={entries} suggestedId={undefined} recentSessions={sessions} dailyQuestionsGoal={settings.questionsPerSession} returnTo="/registro" showForm toggleHref="/registro" /></section> : <Link href="/registro?novo=1" className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Registrar estudo avulso</Link>}</div>;
}
