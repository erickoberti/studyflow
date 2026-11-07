import Link from "next/link";
import { ArrowRight, BookOpen, Check, Clock3, Flame, ListChecks, Play, Repeat2, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { cycleService } from "@/lib/cycle-service";
import { getDashboardData } from "@/lib/analytics";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { studyDayKey, studyWeek } from "@/lib/study-insights";
import { getCycleProgram } from "@/lib/programmed-cycle-service";
import { prisma } from "@/lib/prisma";
import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { StudyProgress, TecReference } from "@/components/study-ui";
import shell from "@/components/official-shell.module.css";
import styles from "./dashboard-screen.module.css";

const shortDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);

export default async function DashboardPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const scope = { userId: user.id, studyGuideId: guide.id };
  const now = new Date();
  const [current, active, preview, dashboard, settings, positionCount, recent, reviews, program] = await Promise.all([
    cycleService.getCurrent(user.id, guide.id), cycleService.getActive(user.id, guide.id), cycleService.preview(user.id, guide.id, 2),
    getDashboardData(user.id, guide.id), getStudyGuideSettings(user.id, guide.id),
    prisma.cycleEntry.count({ where: { ...scope, active: true } }),
    prisma.studySession.findMany({ where: scope, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 3, include: { subject: { include: { discipline: true } }, cycleEntry: { include: { discipline: true } } } }),
    prisma.reviewSchedule.findMany({ where: { ...scope, status: "PENDING" }, orderBy: { dueAt: "asc" }, distinct: ["subjectId"], select: { id: true, dueAt: true, subjectId: true, subject: { select: { name: true } } } }),
    getCycleProgram(user.id, guide.id),
  ]);
  const today = dashboard.byDay.find(day => day.date === studyDayKey(now));
  const questions = today?.questions ?? 0;
  const minutes = today?.estimatedMinutes ?? 0;
  const goal = dashboard.totals.dailyQuestionsGoal;
  const week = studyWeek(dashboard.byDay, now);
  const weekQuestions = week.filter(day => !day.future).reduce((sum, day) => sum + day.questions, 0);
  const weekCorrect = week.filter(day => !day.future).reduce((sum, day) => sum + day.correct, 0);
  const weeklyGoal = dashboard.totals.weeklyQuestionsGoal;
  const due = reviews.filter(review => review.dueAt <= now);
  const upcomingReview = reviews.find(review => review.dueAt > now);
  const discipline = active?.discipline.name ?? current?.entry.discipline.name;
  const subject = active?.subject.name ?? current?.subject.name;
  const subjectId = active?.subject.id ?? current?.subject.id;
  const round = active?.cycle?.round ?? current?.roundNumber ?? program?.currentRound ?? 1;
  const position = active?.cycle?.position ?? current?.entry.orderIndex;
  const sessionGoal = active?.discipline.questionGoal ?? current?.entry.discipline.questionGoal ?? settings.questionsPerSession;
  const programItem = program?.items.find(item => item.entry.orderIndex === position && item.roundNumber === round);
  const referenceSubject = subjectId ? await prisma.subject.findFirst({ where: { ...scope, id: subjectId }, select: { tecReference: true } }) : null;
  const finished = program?.status === "COMPLETED";
  const next = preview[1];
  const performance = [...dashboard.disciplineStats].filter(item => item.questions > 0).sort((a, b) => b.questions - a.questions).slice(0, 3);

  return <div className={`${shell.screen} ${styles.screen}`}>
    <GuideSetupNotice name={guide.name} {...guide._count} />
    <header className={styles.header}>
      <p className="sf-eyebrow">Seu espaço de estudo · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(now)}</p>
      <h1>Olá, {user.name?.split(" ")[0] ?? "Aluno"}.</h1>
      <p>{active ? "Seu estudo está salvo. Retome de onde parou." : finished ? "Programação concluída. Reserve um tempo para consolidar o que aprendeu." : current ? "Um estudo de cada vez. Seu próximo passo está aqui." : "Organize suas matérias para preparar seu próximo estudo."}</p>
    </header>

    <section className={styles.hero} aria-labelledby="next-study-title">
      <div className={styles.heroTop}><span className={styles.status}><span aria-hidden />{active ? active.status === "PAUSED" ? "Sessão pausada" : "Sessão em andamento" : finished ? "Voltas concluídas" : "Próximo estudo"}</span>{current || active ? <Link href="/ciclo">Posição {position}/{positionCount} · volta {round}{program ? `/${program.totalRounds}` : ""}<ArrowRight size={16} aria-hidden /></Link> : null}</div>
      <h2 id="next-study-title">{discipline ?? (finished ? "Um ciclo completo. Um novo passo." : "Prepare seu ciclo de estudos")}</h2>
      <p className={styles.subject}>{subject ?? (finished ? "Seu histórico e suas conclusões estão preservados." : "Comece cadastrando as matérias e os assuntos do seu concurso.")}</p>
      {current || active ? <>
        <dl className={styles.facts}>
          <div><dt><Target size={16} aria-hidden /> Meta da sessão</dt><dd>{sessionGoal} <span>questões</span></dd></div>
          <div><dt><Clock3 size={16} aria-hidden /> Tempo estimado</dt><dd>{settings.sessionMinutes} <span>minutos</span></dd></div>
        </dl>
        <TecReference reference={{ topic: programItem?.tecTopic, discipline: programItem?.tecDiscipline, status: programItem?.tecStatus, url: programItem?.tecUrl, legacy: referenceSubject?.tecReference }} />
        <div className={styles.actions}><Link href="/registro?modo=timer" className="sf-primary"><Play size={17} aria-hidden />{active ? "Retomar sessão" : "Iniciar agora"}</Link><Link href="/registro" className="sf-secondary"><ListChecks size={17} aria-hidden />Registrar sem cronômetro</Link><Link href="/ciclo" className={styles.textLink}>Ver ciclo <ArrowRight size={16} aria-hidden /></Link></div>
      </> : <div className={styles.actions}><Link href={finished ? "/registro?novo=1" : "/base?tab=disciplinas&novo=1"} className="sf-primary">{finished ? "Registrar revisão mista" : "Adicionar matérias"}<ArrowRight size={17} aria-hidden /></Link><Link href={finished ? "/ciclo/configuracao" : "/ciclo"} className="sf-secondary">{finished ? "Planejar novas voltas" : "Configurar ciclo"}</Link></div>}
      {next ? <div className={styles.next}><span>A seguir · #{next.orderIndex}{next.roundNumber !== round ? ` · volta ${next.roundNumber}` : ""}</span><p>{next.discipline.name} <span aria-hidden>→</span> {next.subject.name}</p></div> : null}
    </section>

    <section className={styles.today} aria-label="Plano de hoje">
      <div className={styles.todayGoal}><div><h2>Hoje</h2><span>{questions} / {goal} questões {goal > 0 && questions >= goal ? <Check size={16} aria-label="Meta atingida" /> : null}</span></div><StudyProgress label="Questões de hoje" value={questions} max={goal} /></div>
      <p><Clock3 size={18} aria-hidden /><strong>{Math.floor(minutes / 60)}h {String(minutes % 60).padStart(2, "0")}m</strong><span>estudadas</span></p>
      <p><Flame size={18} aria-hidden /><strong>{dashboard.totals.streakDays} {dashboard.totals.streakDays === 1 ? "dia" : "dias"}</strong><span>de sequência</span></p>
      <Link href="/metas" className={styles.textLink}>Ajustar metas <ArrowRight size={15} aria-hidden /></Link>
    </section>

    <div className={styles.planning}>
      <section className={styles.card} aria-labelledby="weekly-title"><header><div><p className="sf-eyebrow">Consistência</p><h2 id="weekly-title">Sua semana</h2></div><Link href="/metas" className={styles.textLink}>Ver metas <ArrowRight size={15} aria-hidden /></Link></header>
        <div className={styles.weekTotal}><strong>{weekQuestions}<span> / {weeklyGoal} questões</span></strong><span>{weeklyGoal > 0 ? `${Math.round(weekQuestions / weeklyGoal * 100)}% da meta` : "Meta não definida"}</span></div>
        <StudyProgress label="Progresso semanal de questões" value={weekQuestions} max={weeklyGoal} />
        <ol className={styles.week} aria-label="Atividade de segunda a domingo">{week.map(day => <li key={day.date} data-today={day.today} data-future={day.future} data-active={day.questions > 0 || day.minutes > 0} aria-label={`${day.date}: ${day.questions} questões, ${day.minutes} minutos${day.today ? ", hoje" : ""}`}><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`)).replace(".", "")}</span><strong>{day.future ? "—" : day.questions || (day.minutes > 0 ? <Check size={17} aria-label="Conteúdo estudado" /> : "·")}</strong><small>{day.today ? "hoje" : day.date.slice(-2)}</small></li>)}</ol>
        <p className={styles.caption}>Segunda a domingo · {weekQuestions ? `${(weekCorrect / weekQuestions * 100).toFixed(0)}% de acertos nesta semana` : "Cada sessão conta para construir sua rotina."}</p>
      </section>
      <section className={`${styles.card} ${styles.review}`} aria-labelledby="pending-reviews-title"><header><div><p className="sf-eyebrow">Consolidar o aprendizado</p><h2 id="pending-reviews-title">Revisões pendentes</h2></div><Repeat2 size={22} aria-hidden /></header><p className={styles.reviewCount}><strong>{due.length}</strong><span>{due.length === 1 ? "assunto para revisar" : "assuntos para revisar"}</span></p><p>{due.length ? "Reforce os pontos de dificuldade no seu ritmo. As revisões não bloqueiam o ciclo." : upcomingReview ? `Próxima revisão: ${shortDate(upcomingReview.dueAt)} · ${upcomingReview.subject.name}.` : "Tudo em dia. As sugestões aparecem conforme seus resultados de questões."}</p><Link href="/revisao" className="sf-secondary">{due.length ? "Organizar revisões" : "Ver revisões agendadas"}<ArrowRight size={16} aria-hidden /></Link></section>
    </div>

    <div className={styles.results}>
      <section className={styles.card} aria-labelledby="recent-studies-title"><header><div><p className="sf-eyebrow">Últimos registros</p><h2 id="recent-studies-title">Atividade recente</h2></div><Link href="/registros" className={styles.textLink}>Ver histórico <ArrowRight size={15} aria-hidden /></Link></header><div className={styles.recentList}>{recent.map(session => <article key={session.id}><span className={styles.activityIcon}><BookOpen size={20} aria-hidden /></span><div><h3>{session.scope === "GENERAL" ? "Revisão geral" : session.disciplineNameSnapshot ?? session.subject?.discipline.name ?? session.cycleEntry?.discipline?.name ?? "Matéria anterior"}</h3><p>{session.scope === "GENERAL" ? "Todas as matérias" : session.subjectNameSnapshot ?? session.subject?.name ?? "Assunto anterior"}</p><small>{shortDate(session.date)} · {session.estimatedMinutes} min{session.questions ? ` · ${session.questions} questões` : " · conteúdo"}</small></div><div className={styles.score} data-tone={session.percentage >= 70 ? "success" : "warning"}><strong>{session.questions ? `${session.percentage.toFixed(0)}%` : `${session.estimatedMinutes}m`}</strong><small>{session.questions ? `${session.correct} acertos · ${session.wrong} erros` : "estudados"}</small></div></article>)}{!recent.length ? <p className={styles.empty}>Suas sessões concluídas aparecerão aqui. Comece pelo próximo estudo.</p> : null}</div></section>
      <section className={styles.card} aria-labelledby="performance-title"><header><div><p className="sf-eyebrow">Acumulado do guia</p><h2 id="performance-title">Desempenho por matéria</h2></div></header>{performance.map(item => <article className={styles.performance} key={item.discipline}><div><h3>{item.discipline}</h3><strong>{item.percentage.toFixed(0)}%</strong></div><StudyProgress label={`Acertos em ${item.discipline}`} value={item.percentage} /><p>{item.questions} questões · {item.correct} acertos · {item.wrong} erros</p></article>)}{!performance.length ? <p className={styles.empty}>Ainda sem questões suficientes para avaliar o desempenho. Estudos de conteúdo continuam contando como tempo dedicado.</p> : null}<Link href="/estatisticas" className={styles.textLink}>Explorar desempenho por assunto <ArrowRight size={15} aria-hidden /></Link></section>
    </div>
  </div>;
}
