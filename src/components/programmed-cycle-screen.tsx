import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cycleService } from "@/lib/cycle-service";
import type { LoadedProgram } from "@/lib/programmed-cycle-service";
import { setCyclePosition } from "@/app/actions";
import shell from "./official-shell.module.css";
import styles from "@/app/(app)/ciclo/cycle-screen.module.css";

export async function ProgrammedCycleScreen({ program, userId, studyGuideId, adjustment }: { program: LoadedProgram; userId: string; studyGuideId: string; adjustment?: string }) {
  const [current, preview, sessions, state] = await Promise.all([
    cycleService.getCurrent(userId, studyGuideId), cycleService.preview(userId, studyGuideId, 2),
    prisma.studySession.findMany({ where: { userId, studyGuideId }, include: { subject: { include: { discipline: true } } }, orderBy: { date: "desc" } }),
    prisma.studyGuideCycleState.findUnique({ where: { studyGuideId } }),
  ]);
  const items = program.items.filter(item => item.roundNumber === program.currentRound);
  const completed = items.filter(item => item.completion).length;
  const totalQuestions = items.reduce((sum, item) => sum + item.questionGoal, 0);
  const next = preview[1];
  const currentItem = items.find(item => item.entryId === current?.entry.id);
  const currentHistory = sessions.filter(session => session.programItemId === currentItem?.id);
  const currentQuestions = currentHistory.reduce((sum, session) => sum + session.questions, 0);
  return <div className={`${shell.screen} ${styles.screen}`}>
    {adjustment === "sessao-ativa" || adjustment === "invalido" ? <p role="status" className="rounded-control border bg-surface p-4 text-sm">{adjustment === "sessao-ativa" ? "Finalize ou cancele a sessão em andamento antes de trocar de posição." : "Esta posição não está disponível na volta atual."}</p> : null}
    <header className={styles.header}><p className={styles.eyebrow}>Ciclo programado · volta {program.currentRound}/{program.totalRounds}</p><h1>Ciclo de estudos</h1><p>16 posições fixas · {totalQuestions} questões planejadas nesta volta.</p><Link href="/ciclo/configuracao" className="sf-secondary mt-3">Ver e editar a matriz das voltas</Link></header>
    {program.status === "COMPLETED" ? <section className={styles.hero}><div className={styles.currentStudy}><div><h2>Programação concluída</h2><p>Você concluiu as 16 posições de cada uma das {program.totalRounds} voltas. Seu histórico está preservado.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/registro?novo=1" className="sf-primary">Iniciar revisão mista</Link><Link href="/ciclo/configuracao" className="sf-secondary">Programar novas voltas</Link></div><p className="mt-2 text-xs text-textSecondary">Na revisão mista, escolha “Revisão geral” para registrar o estudo sem alterar as voltas concluídas.</p></div></div></section> : current ? <section className={styles.hero}><div className={styles.currentStudy}><div><p className={styles.eyebrow}>Agora · posição {current.entry.orderIndex}/16 · volta {program.currentRound}/{program.totalRounds}</p><h2>{current.entry.discipline.name} <span>→ {current.subject.name}</span></h2><div className={styles.heroFacts}><span>Meta: {current.entry.discipline.questionGoal} questões</span><span>Registradas nesta posição e volta: {currentQuestions}</span></div>{currentItem && (currentItem.tecTopic || currentItem.tecDiscipline || currentItem.tecUrl) ? <p className="mt-3 text-xs text-textSecondary">TecConcursos · {currentItem.tecStatus === "CONFIRMED" ? "classificação confirmada por você" : "referência sugerida"}: {[currentItem.tecDiscipline, currentItem.tecTopic].filter(Boolean).join(" → ")} {currentItem.tecUrl ? <a href={currentItem.tecUrl} target="_blank" rel="noreferrer" className="text-primary underline">Abrir caderno ou filtro</a> : null}</p> : null}</div><Link href="/registro" className="sf-primary">Continuar estudo</Link></div><div className={styles.nextStudy}><span>A seguir{next && next.roundNumber !== program.currentRound ? ` · volta ${next.roundNumber}` : ""}</span><p>{next ? `${next.discipline.name} → ${next.subject.name}` : "Concluir a programação e escolher revisão mista ou novas voltas."}</p></div></section> : null}
    <section className={styles.progress} aria-label="Progresso da volta"><div><strong>{completed}/16 posições concluídas</strong><span>Posição atual: {state?.currentOrderIndex ?? 1}/16</span></div><div role="progressbar" aria-label="Posições concluídas na volta" aria-valuemin={0} aria-valuemax={16} aria-valuenow={completed}><i style={{ width: `${completed / 16 * 100}%` }}/></div><p>A volta avança somente após concluir as 16 posições. Mudar o ponto atual não conclui um estudo.</p></section>
    <section className={styles.trail} id="sequencia" aria-labelledby="cycle-sequence-title"><h2 id="cycle-sequence-title">Sequência completa · volta {program.currentRound}</h2><ol className={`${styles.sequence} mt-3`}>{items.map(item => {
      const history = sessions.filter(session => session.cycleEntryId === item.entryId);
      const questions = history.reduce((sum, session) => sum + session.questions, 0);
      const correct = history.reduce((sum, session) => sum + session.correct, 0);
      const accuracy = questions ? correct / questions * 100 : null;
      const isCurrent = current?.entry.id === item.entryId;
      return <li key={item.id} className={styles.row} data-current={isCurrent} data-next={next?.entryId === item.entryId && next.roundNumber === program.currentRound} aria-current={isCurrent ? "step" : undefined}>
        <span className={styles.position}>{item.entry.orderIndex}</span><div className={styles.rowText}><p><strong>{item.discipline.name}</strong> <span>→</span> {item.subject.name}</p><small>Meta: {item.questionGoal} questões · Histórico: {questions} questões, {correct} acertos, {questions - correct} erros{accuracy !== null ? ` · ${accuracy.toFixed(0)}%` : ""}</small>
        <details className="mt-1"><summary className="cursor-pointer text-xs text-primary">Histórico desta posição ({history.length})</summary><div className="space-y-2 py-2">{history.map(session => <p key={session.id} className="text-xs"><strong>{session.disciplineNameSnapshot ?? session.subject?.discipline.name ?? "Matéria anterior"}</strong> → {session.subjectNameSnapshot ?? session.subject?.name ?? "Assunto anterior"} · {session.programItemId ? `volta ${session.cycleRound}` : "histórico anterior"} · {session.questions} questões, {session.correct} acertos, {session.wrong} erros · {session.percentage.toFixed(0)}% · {session.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>)}{!history.length ? <p className="text-xs">Nenhum estudo registrado nesta posição.</p> : null}</div></details></div>
        <span className={styles.status}>{item.completion ? "Concluída" : isCurrent ? "Agora" : next?.entryId === item.entryId && next.roundNumber === program.currentRound ? "A seguir" : "Pendente"}</span><div className={styles.rowActions}>{program.status === "ACTIVE" && !isCurrent ? <form action={setCyclePosition}><input type="hidden" name="entryId" value={item.entryId}/><button className="min-h-11 px-1 text-[11px] text-primary" aria-label={`Estudar posição ${item.entry.orderIndex}`}>Estudar</button></form> : null}</div>
      </li>;
    })}</ol></section>
    <p className="text-xs text-textSecondary">Abaixo de 60%: revisão prioritária em 1 dia. De 60% a menos de 80%: revisão em 7 dias. A partir de 80%: revisão em 30 dias. As revisões não bloqueiam o ciclo. <Link href="/revisao" className="text-primary underline">Ver revisões</Link></p>
  </div>;
}
