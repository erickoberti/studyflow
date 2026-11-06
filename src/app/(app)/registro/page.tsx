import styles from "./study-screen.module.css";
import Link from "next/link";
import { getCycleProgram } from "@/lib/programmed-cycle-service";

import { StudySessionForm } from "@/components/forms/study-session-form";
import { ActiveStudyPanel } from "@/components/study/active-study-panel";
import { requireUser } from "@/lib/auth";
import { cycleService } from "@/lib/cycle-service";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { getDashboardData } from "@/lib/analytics";
import type { StudyActivity } from "@/lib/study-activity";

function preferredActivity(tipo?: string): StudyActivity {
  if (tipo === "video" || tipo === "aula") return "CLASS";
  if (tipo === "lei") return "READING";
  if (tipo === "pdf") return "PDF_READING";
  return "QUESTIONS";
}

export default async function RegistroPage({ searchParams }: { searchParams?: Promise<{ novo?: string; tipo?: string; modo?: string }> }) {
  const params = await searchParams;
  const user = await requireUser(); const guide = await requireActiveStudyGuide(user.id);
  const [current, recentSessions, settings, active, dashboard, focusPreview, guides] = await Promise.all([
    cycleService.getCurrent(user.id, guide.id),
    prisma.studySession.findMany({ where: { userId: user.id, studyGuideId: guide.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5, include: { subject: { include: { discipline: true } }, cycleEntry: { include: { discipline: true } } } }),
    getStudyGuideSettings(user.id, guide.id), cycleService.getActive(user.id, guide.id), getDashboardData(user.id, guide.id), cycleService.preview(user.id, guide.id, 2),
    prisma.studyGuide.findMany({
      where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, disciplines: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, subjects: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, weight: true } } } } },
    }),
  ]);
  const sessions = recentSessions.map((session) => ({ ...session, subjectName: session.scope === "GENERAL" ? "Revisão geral" : session.subjectNameSnapshot ?? session.subject?.name ?? "Assunto legado indisponível", disciplineName: session.scope === "GENERAL" ? "Todas as matérias" : session.disciplineNameSnapshot ?? session.subject?.discipline.name ?? session.cycleEntry?.discipline?.name ?? "Disciplina" }));
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayData = dashboard.byDay.find((item) => item.date === today); const next = focusPreview[1];
  const subjectId=active?.subject.id??current?.subject.id;
  const [subject,positions]=await Promise.all([subjectId?prisma.subject.findFirst({where:{id:subjectId,userId:user.id,studyGuideId:guide.id},include:{progress:true}}):null,prisma.cycleEntry.count({where:{userId:user.id,studyGuideId:guide.id,active:true}})]);
  const finishedProgram = !current && !active ? await getCycleProgram(user.id, guide.id) : null;
  if (finishedProgram?.status === "COMPLETED" && params?.novo !== "1") return <div className={styles.screen}><h1 className="text-2xl font-semibold">Voltas concluídas</h1><p className="mt-3 text-sm text-textSecondary">As {finishedProgram.totalRounds} voltas estão concluídas. Seu histórico está preservado.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/registro?novo=1" className="sf-primary">Registrar revisão mista</Link><Link href="/ciclo/configuracao" className="sf-secondary">Programar novas voltas</Link></div></div>;
  return <div className={styles.screen}>
    <h1 className="sr-only">Estudar</h1>
    {finishedProgram?.status !== "COMPLETED" ? <ActiveStudyPanel userId={user.id} studyGuideId={guide.id} initialActive={active as never} suggestion={current as never} nextSuggestion={next ? { discipline: next.discipline.name, subject: next.subject.name, position: next.orderIndex } : null} referencePresentation={{positions,average:subject?.progress?.averagePercentage??0,lastStudiedAt:subject?.progress?.lastStudiedAt?.toISOString()??null}} initialVisualMode={params?.modo==="timer"?"TIMER":undefined} defaultMinutes={settings.sessionMinutes} preferredActivity={preferredActivity(params?.tipo)} showStandaloneLink={params?.novo !== "1"} summary={{ todayMinutes: todayData?.estimatedMinutes ?? 0, todayQuestions: todayData?.questions ?? 0, dailyGoal: dashboard.totals.dailyQuestionsGoal, streak: dashboard.totals.streakDays }} /> : <p className="text-sm text-textSecondary">Revisão mista: escolha “Revisão geral” no formulário. Ela não reabre as voltas concluídas.</p>}
    {params?.novo === "1" ? <StudySessionForm guides={guides} initialGuideId={guide.id} recentSessions={sessions} dailyQuestionsGoal={settings.questionsPerSession} toggleHref="/registro" /> : null}
  </div>;
}

