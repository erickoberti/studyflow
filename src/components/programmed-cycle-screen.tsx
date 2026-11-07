import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cycleService } from "@/lib/cycle-service";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import type { LoadedProgram } from "@/lib/programmed-cycle-service";
import { setCyclePosition } from "@/app/actions";
import { CycleOverview, CycleSequenceItem } from "./cycle-sequence";
import { StudyProgress, TecReference } from "./study-ui";
import shell from "./official-shell.module.css";
import styles from "@/app/(app)/ciclo/cycle-screen.module.css";

export async function ProgrammedCycleScreen({ program, userId, studyGuideId, adjustment }: { program: LoadedProgram; userId: string; studyGuideId: string; adjustment?: string }) {
  const scope = { userId, studyGuideId };
  const [current, preview, aggregates, entries, active, settings] = await Promise.all([
    cycleService.getCurrent(userId, studyGuideId), cycleService.preview(userId, studyGuideId, 2),
    prisma.studySession.groupBy({ by: ["cycleEntryId", "programItemId"], where: scope, _sum: { questions: true, correct: true, wrong: true, estimatedMinutes: true }, _count: { _all: true } }),
    prisma.cycleEntry.findMany({ where: scope, select: { id: true, sessions: { where: scope, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5, select: { id: true, date: true, questions: true, correct: true, wrong: true, estimatedMinutes: true, cycleRound: true, programItemId: true, disciplineNameSnapshot: true, subjectNameSnapshot: true, subject: { select: { name: true, discipline: { select: { name: true } } } } } } } }),
    cycleService.getActive(userId, studyGuideId), getStudyGuideSettings(userId, studyGuideId),
  ]);
  const items = program.items.filter(item => item.roundNumber === program.currentRound);
  const completed = items.filter(item => item.completion).length;
  const totalQuestions = items.reduce((sum, item) => sum + item.questionGoal, 0);
  const next = preview[1];
  const currentItem = items.find(item => item.entryId === current?.entry.id);
  const currentQuestions = aggregates.find(row => row.programItemId === currentItem?.id)?._sum.questions ?? 0;
  const historyByEntry = new Map(entries.map(entry => [entry.id, entry.sessions]));
  const positions = items.map(item => {
    const isCurrent = current?.entry.id === item.entryId;
    const isNext = next?.entryId === item.entryId && next.roundNumber === program.currentRound;
    return { position: item.entry.orderIndex, matter: item.discipline.name, subject: item.subject.name, current: isCurrent, next: isNext, completed: Boolean(item.completion), status: isCurrent ? item.completion ? "Agora · concluída" : "Agora" : item.completion ? "Concluída" : isNext ? "A seguir" : "Pendente" };
  });
  return <div className={`${shell.screen} ${styles.screen}`}>
    {adjustment ? <p role="status" className="rounded-control border bg-surface p-4 text-sm">{adjustment === "sessao-ativa" ? "Finalize ou cancele a sessão em andamento antes de trocar de posição." : adjustment === "ok" ? "Ponto atualizado. A próxima sessão começará daqui." : "Esta posição não está disponível na volta atual."}</p> : null}
    <header className={styles.header}><p className={styles.eyebrow}>Seu roteiro · volta {program.currentRound}/{program.totalRounds}</p><h1>Ciclo de estudos</h1><p>16 posições fixas · {totalQuestions} questões planejadas nesta volta.</p><Link href="/ciclo/configuracao" className="sf-secondary mt-3">Ver e editar a matriz das voltas</Link></header>

    <section className={styles.rounds} aria-label="Visão das voltas programadas">{Array.from({ length: program.totalRounds }, (_, index) => {
      const round = index + 1;
      const count = program.items.filter(item => item.roundNumber === round && item.completion).length;
      return <article key={round} data-current={round === program.currentRound} aria-current={round === program.currentRound ? "step" : undefined}><div><h2>Volta {round}</h2><span>{count === 16 ? "Concluída" : round === program.currentRound ? "Atual" : "Programada"}</span></div><StudyProgress label={`Progresso da volta ${round}`} value={count} max={16} /><p>{count}/16 posições concluídas</p></article>;
    })}</section>

    {program.status === "COMPLETED" ? <section className={styles.hero}><div className={styles.currentStudy}><div><h2>Programação concluída</h2><p>Você concluiu as 16 posições de cada uma das {program.totalRounds} voltas. Seu histórico está preservado.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/registro?novo=1" className="sf-primary">Iniciar revisão mista</Link><Link href="/ciclo/configuracao" className="sf-secondary">Programar novas voltas</Link></div><p className="mt-2 text-xs text-textSecondary">Escolha “Revisão geral” para estudar sem reabrir as voltas concluídas.</p></div></div></section> : current ? <section className={styles.hero}><div className={styles.currentStudy}><div><p className={styles.eyebrow}>Agora · posição {current.entry.orderIndex}/16 · volta {program.currentRound}/{program.totalRounds}</p><h2>{current.entry.discipline.name} <span>→ {current.subject.name}</span></h2><div className={styles.heroFacts}><span>Meta: {currentItem?.questionGoal ?? current.entry.discipline.questionGoal} questões</span><span>~{settings.sessionMinutes} minutos</span><span>{currentQuestions} questões registradas nesta posição e volta</span></div></div><Link href="/registro?modo=timer" className="sf-primary"><Play size={17} aria-hidden />{active ? "Retomar sessão" : "Iniciar estudo"}</Link></div>{currentItem ? <div className="px-5 pb-5"><TecReference reference={{ topic: currentItem.tecTopic, discipline: currentItem.tecDiscipline, url: currentItem.tecUrl, status: currentItem.tecStatus, legacy: currentItem.subject.tecReference }} /></div> : null}<div className={styles.nextStudy}><span>A seguir{next && next.roundNumber !== program.currentRound ? ` · volta ${next.roundNumber}` : ""}</span><p>{next ? `${next.discipline.name} → ${next.subject.name}` : "Concluir a programação e escolher revisão mista ou novas voltas."}</p></div></section> : null}

    <section className={styles.progress} aria-label="Progresso da volta"><div><strong>{completed}/16 posições concluídas</strong><span>Posição atual: {current?.entry.orderIndex ?? "—"}/16</span></div><StudyProgress label="Posições concluídas na volta" value={completed} max={16} /><p>A volta avança após concluir as 16 posições. Mudar o ponto atual não conclui um estudo.</p></section>
    <CycleOverview positions={positions} />
    <section className={styles.trail} id="sequencia" aria-labelledby="cycle-sequence-title"><h2 id="cycle-sequence-title">Sequência completa · volta {program.currentRound}</h2><p className={styles.trailHint}>Abra uma posição para consultar assunto, desempenho e últimas sessões.</p><ol className={`${styles.sequence} mt-3`}>{items.map((item, index) => {
      const history = historyByEntry.get(item.entryId) ?? [];
      const currentStats = aggregates.find(row => row.programItemId === item.id);
      const accumulated = aggregates.filter(row => row.cycleEntryId === item.entryId);
      const questions = currentStats?._sum.questions ?? 0;
      const correct = currentStats?._sum.correct ?? 0;
      const total = accumulated.reduce((sum, row) => sum + (row._sum.questions ?? 0), 0);
      const allCorrect = accumulated.reduce((sum, row) => sum + (row._sum.correct ?? 0), 0);
      return <CycleSequenceItem key={item.id} {...positions[index]}>
        <p><strong>Nesta volta:</strong> {questions ? `${questions} questões · ${correct} acertos · ${currentStats?._sum.wrong ?? 0} erros · ${(correct / questions * 100).toFixed(0)}%` : "Sem questões registradas."} Meta: {item.questionGoal} questões.</p>
        {total > 0 ? <p><strong>Acumulado da posição:</strong> {total} questões · {(allCorrect / total * 100).toFixed(0)}% de acertos, incluindo outras voltas e assuntos.</p> : null}
        <TecReference reference={{ topic: item.tecTopic, discipline: item.tecDiscipline, url: item.tecUrl, status: item.tecStatus, legacy: item.subject.tecReference }} />
        {history.length ? <details><summary className="cursor-pointer text-sm text-primary">Últimas sessões desta posição</summary><ul className={styles.sessionHistory}>{history.map(session => <li key={session.id}><strong>{session.disciplineNameSnapshot ?? session.subject?.discipline.name ?? "Matéria anterior"}</strong> → {session.subjectNameSnapshot ?? session.subject?.name ?? "Assunto anterior"}<p>{session.programItemId ? `Volta ${session.cycleRound} · ` : "Histórico anterior · "}{session.questions ? `${session.questions} questões, ${session.correct} acertos, ${session.wrong} erros` : "Conteúdo"} · {session.estimatedMinutes} min · {session.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></li>)}</ul></details> : <p>Nenhum estudo registrado nesta posição.</p>}
        <div className="flex flex-wrap gap-3"><Link href={`/registros?posicao=${item.entryId}`} className="sf-secondary">Ver histórico da posição <ArrowRight size={15} aria-hidden /></Link>{program.status === "ACTIVE" && !positions[index].current ? <form action={setCyclePosition}><input type="hidden" name="entryId" value={item.entryId} /><button className="sf-secondary" aria-label={`Estudar posição ${item.entry.orderIndex}`}>Estudar esta posição</button></form> : null}</div>
      </CycleSequenceItem>;
    })}</ol></section>
    <p className="text-sm leading-relaxed text-textSecondary">As revisões sugeridas pelos erros ficam na <Link href="/revisao" className="text-primary underline">Central de revisões</Link> e não bloqueiam a sequência do ciclo.</p>
  </div>;
}
