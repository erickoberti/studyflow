import { ClipboardCheck, Clock3 } from "lucide-react";
import shell from "@/components/official-shell.module.css";
import styles from "./history-screen.module.css";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/components/forms/session-manager";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getCyclePositionSuggestions } from "@/lib/cycle-strategy";

export default async function RegistrosPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const [sessions, suggestions, subjects] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: guide.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { subject: { include: { discipline: true } }, cycleEntry: { include: { discipline: true, subject: { include: { discipline: true } } } } },
    }),
    getCyclePositionSuggestions(user.id, guide.id),
    prisma.subject.findMany({ where: { userId: user.id, studyGuideId: guide.id }, include: { discipline: true }, orderBy: { name: "asc" } }),
  ]);
  const safeSessions = sessions.map((item) => ({
    id: item.id, cycleEntryId: item.cycleEntryId, subjectId: item.subjectId, scope: item.scope, date: item.date.toISOString(), questions: item.questions, correct: item.correct, wrong: item.wrong,
    percentage: item.percentage, estimatedMinutes: item.estimatedMinutes, activityType: item.activityType, notes: item.notes ?? "",
    subjectName: item.scope === "GENERAL" ? "Revisão geral" : item.subject?.name ?? item.cycleEntry?.subject?.name ?? "Assunto legado indisponível",
    disciplineName: item.scope === "GENERAL" ? "Todas as matérias" : item.subject?.discipline.name ?? item.cycleEntry?.discipline?.name ?? item.cycleEntry?.subject?.discipline.name ?? "Disciplina",
  }));
  const cycleEntries = suggestions.map((item) => ({ id: item.entryId, subjectId: item.subject?.id ?? null, orderIndex: item.orderIndex, subjectName: item.subject?.name ?? "Assunto sugerido indisponível", disciplineName: item.discipline }));
  const totalQuestions=sessions.reduce((n,s)=>n+s.questions,0); const totalCorrect=sessions.reduce((n,s)=>n+s.correct,0); const minutes=sessions.reduce((n,s)=>n+s.estimatedMinutes,0);
  return <div className={`${shell.screen} ${styles.screen}`}><header className={styles.header}><div><p className={styles.eyebrow}><span>● Registros de estudo</span> · {sessions.length} sessões documentadas</p><h1>Histórico &amp; Evolução</h1><p>Linha do tempo detalhada das sessões práticas, resoluções de questões e revisões de teoria com métricas de rendimento.</p></div><div className={styles.metrics}><article><span><ClipboardCheck size={20}/></span><div><small>Taxa global</small><b>{totalQuestions?(totalCorrect/totalQuestions*100).toFixed(1):'0'}%</b></div></article><article><span><Clock3 size={20}/></span><div><small>Horas líquidas</small><b>{Math.floor(minutes/60)}h {minutes%60}m</b></div></article></div></header><SessionManager sessions={safeSessions} cycleEntries={cycleEntries} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name, disciplineName: subject.discipline.name }))} /></div>;
}
