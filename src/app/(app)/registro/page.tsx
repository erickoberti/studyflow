import styles from "./study-screen.module.css";

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
  const sessions = recentSessions.map((session) => ({ ...session, subjectName: session.scope === "GENERAL" ? "Revisão geral" : session.subject?.name ?? "Assunto legado indisponível", disciplineName: session.scope === "GENERAL" ? "Todas as matérias" : session.subject?.discipline.name ?? session.cycleEntry?.discipline?.name ?? "Disciplina" }));
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayData = dashboard.byDay.find((item) => item.date === today); const next = focusPreview[1];
  const subjectId=active?.subject.id??current?.subject.id;
  const [subject,positions]=await Promise.all([subjectId?prisma.subject.findFirst({where:{id:subjectId,userId:user.id,studyGuideId:guide.id},include:{progress:true}}):null,prisma.cycleEntry.count({where:{userId:user.id,studyGuideId:guide.id,active:true}})]);
  return <div className={styles.screen}>
    <h1 className="sr-only">Estudar</h1>
    <ActiveStudyPanel userId={user.id} studyGuideId={guide.id} initialActive={active as never} suggestion={current as never} nextSuggestion={next ? { discipline: next.discipline.name, subject: next.subject.name, position: next.orderIndex } : null} referencePresentation={{positions,average:subject?.progress?.averagePercentage??0,lastStudiedAt:subject?.progress?.lastStudiedAt?.toISOString()??null}} initialVisualMode={params?.modo==="timer"?"TIMER":undefined} defaultMinutes={settings.sessionMinutes} preferredActivity={preferredActivity(params?.tipo)} showStandaloneLink={params?.novo !== "1"} summary={{ todayMinutes: todayData?.estimatedMinutes ?? 0, todayQuestions: todayData?.questions ?? 0, dailyGoal: dashboard.totals.dailyQuestionsGoal, streak: dashboard.totals.streakDays }} />
    {params?.novo === "1" ? <StudySessionForm guides={guides} initialGuideId={guide.id} recentSessions={sessions} dailyQuestionsGoal={settings.questionsPerSession} toggleHref="/registro" /> : null}
  </div>;
}

