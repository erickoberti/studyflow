import shell from "@/components/official-shell.module.css";
import styles from "./cycle-screen.module.css";
import Link from "next/link";
import {
  addCycleEntry,
  deleteAllCycleEntries,
  deleteCycleEntry,
  duplicateCycleEntry,
  moveCycleEntry,
  setCyclePosition,
  toggleCycleEntry,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { getCyclePositionSuggestions } from "@/lib/cycle-strategy";
import { cycleService } from "@/lib/cycle-service";
import {
  ArrowRight,
  BookOpen,
  CircleCheckBig,
  Clock3,
  RefreshCcw,
  Route,
  Hourglass,
  Download,
  GripVertical,
  Play,
  Plus,
  Target,
  Trash2,
} from "lucide-react";

function minutesForWeight(weight: number) {
  return Math.max(30, Number(weight) * 30);
}

function statusForEntry(entry: { active: boolean; orderIndex: number }, currentOrder: number | null) {
  if (!entry.active) return "AGUARDANDO";
  if (currentOrder !== null && entry.orderIndex < currentOrder) return "CONCLUIDO";
  if (currentOrder !== null && entry.orderIndex === currentOrder) return "EM ANDAMENTO";
  return "PENDENTE";
}

function statusChip(status: string) {
  if (status === "CONCLUIDO") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (status === "EM ANDAMENTO") return "bg-primary/15 text-primary";
  if (status === "PENDENTE") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  return "bg-slate-200 text-textSecondary dark:bg-slate-700 dark:text-textSecondary";
}

export default async function CicloPage({
  searchParams,
}: {
  searchParams?: Promise<{ novo?: string; ajuste?: string; todas?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));

  const [entries, subjects, aggregates, settings, cycleSuggestions, cycleState, weeklyAggregate, currentCycle] = await Promise.all([
    prisma.cycleEntry.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      include: { subject: { include: { discipline: true } }, discipline: true },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, studyGuideId: guide.id, active: true, discipline: { active: true } },
      include: { discipline: true },
      orderBy: [{ discipline: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.studySession.groupBy({
      by: ["cycleEntryId"],
      where: { userId: user.id, studyGuideId: guide.id },
      _sum: { questions: true, correct: true, estimatedMinutes: true },
      _max: { date: true },
    }),
    getStudyGuideSettings(user.id, guide.id),
    getCyclePositionSuggestions(user.id, guide.id),
    prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: guide.id }, select: { currentOrderIndex: true, roundNumber: true } }),
    prisma.studySession.aggregate({ where: { userId: user.id, studyGuideId: guide.id, date: { gte: weekStart } }, _sum: { questions: true } }),
    cycleService.getCurrent(user.id, guide.id),
  ]);

  const showAdd = params?.novo === "1";
  const suggestionByEntry = new Map(cycleSuggestions.map((item) => [item.entryId, item]));
  const displayEntries = entries.map((entry) => {
    const suggestion = suggestionByEntry.get(entry.id);
    return {
      ...entry,
      subject: entry.subject ?? {
        name: suggestion?.subject?.name ?? "Sem assunto ativo",
        weight: suggestion?.subject?.weight ?? 1,
        discipline: { name: suggestion?.discipline ?? entry.discipline?.name ?? "Disciplina" },
      },
    };
  });
  const aggMap = new Map(
    aggregates.map((aggregate) => [
      aggregate.cycleEntryId,
      {
        questions: aggregate._sum.questions ?? 0,
        correct: aggregate._sum.correct ?? 0,
      },
    ]),
  );

  const currentOrder = currentCycle?.entry.orderIndex ?? cycleState?.currentOrderIndex ?? entries.find((entry) => entry.active)?.orderIndex ?? null;
  const activeEntries = displayEntries.filter((entry) => entry.active);
  const nextEntry = activeEntries.find((entry) => entry.orderIndex > (currentOrder ?? 0));
  const lastStudiedAt = aggregates.find((item) => item.cycleEntryId === currentCycle?.entry.id)?._max.date;
  const adjustmentMessage =
    params?.ajuste === "ok"
      ? "Ponto do ciclo atualizado. A próxima sessão começará daqui."
      : params?.ajuste === "sessao-ativa"
        ? "Finalize ou cancele a sessão em andamento antes de alterar o ciclo."
        : params?.ajuste === "invalido"
          ? "Essa posição não está disponível neste guia."
          : null;
  const totalMinutes = aggregates.reduce((sum, aggregate) => sum + (aggregate._sum.estimatedMinutes ?? 0), 0);
  const totalQuestions = aggregates.reduce((sum, aggregate) => sum + (aggregate._sum.questions ?? 0), 0);
  const totalCorrect = aggregates.reduce((sum, aggregate) => sum + (aggregate._sum.correct ?? 0), 0);
  const weeklyGoal = Math.max(1, settings.weeklyQuestionsGoal);
  const weeklyQuestions = weeklyAggregate._sum.questions ?? 0;
  const weeklyProgress = Math.min(100, (weeklyQuestions / weeklyGoal) * 100);
  const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  const nearbyStart = Math.max(0, Math.min(displayEntries.findIndex(e=>e.orderIndex===currentOrder)-1,displayEntries.length-5));
  const visibleEntries=params?.todas==="1"?displayEntries:displayEntries.slice(nearbyStart,nearbyStart+5);
  return (
    <div className={`${shell.screen} ${styles.screen}`}>
      <header className={styles.header}><div className={styles.context}><span>● Meu ciclo de estudos · volta {cycleState?.roundNumber??1} · Posição {currentOrder??'—'} de {activeEntries.length}</span><small>Planejamento ativo: <b>{guide.name}</b></small></div><div className={styles.heading}><div><h1>Sequência &amp; Ritmo do Ciclo</h1><p>Continue pela ordem do seu ciclo, com os pesos e as metas definidos para cada matéria.</p></div><section aria-label="Métricas do ciclo" className={styles.metrics}><article><Clock3 size={20}/><div><small>Tempo total</small><b>{(totalMinutes/60).toFixed(1)}h totais</b></div></article><article><Target size={20}/><div><small>Meta semanal</small><b>{weeklyProgress.toFixed(0)}%</b><span>({weeklyQuestions}/{weeklyGoal} q.)</span></div></article><article><RefreshCcw size={20}/><div><small>Status</small><b>Volta {cycleState?.roundNumber??1} em curso</b></div></article></section></div></header>      {showAdd ? (
        <section className="rounded-xl border border-slate-200 bg-surface p-5 dark:border-white/5 dark:bg-panelDark">
          <form action={addCycleEntry} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-slate-700 dark:text-textSecondary">
              Assunto
              <select
                name="subjectId"
                defaultValue={subjects[0]?.id}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-elevated dark:text-slate-100"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.discipline.name} - {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-white">
              Adicionar
            </button>
          </form>
        </section>
      ) : null}

      {adjustmentMessage ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            params?.ajuste === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {adjustmentMessage}
        </p>
      ) : null}

      {currentCycle ? (
        <section className={styles.hero}>
          <RefreshCcw className={styles.heroWatermark} aria-hidden />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={styles.heroLabels}><p className={styles.heroTag}>Ponto atual · bloco #{currentCycle.entry.orderIndex}</p><span>{currentCycle.entry.discipline.name}</span></div><p className={styles.weight}>● Peso {currentCycle.subject.weight.toFixed(1)}{currentCycle.subject.weight >= 2 ? " (Alto impacto)" : ""}</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {currentCycle.entry.discipline.name} <span>→ {currentCycle.subject.name}</span>
              </h2>
              <p className="mt-2 text-sm text-textSecondary dark:text-textSecondary">
                A meta é atingir {currentCycle.entry.discipline.questionGoal} questões resolvidas nesta sessão. O StudyFlow continuará deste ponto.
              </p>
              <div className={styles.heroFacts}>
                <span><Hourglass size={17}/> Duração estimada: <b>{minutesForWeight(currentCycle.subject.weight)} min</b></span>
                <span><BookOpen size={17}/> Exercícios planejados: <b>{currentCycle.entry.discipline.questionGoal} itens</b></span>
                <span><Clock3 size={17}/> Último estudo: <b>{lastStudiedAt ? lastStudiedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Ainda não registrado"}</b></span>
              </div>
            </div>
            <div className={styles.heroActions}>
            <Link
              href="/registro"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft"
            >
              <Play size={17} fill="currentColor" /> Continuar este bloco
            </Link>
            {nextEntry ? <form action={setCyclePosition}><input type="hidden" name="entryId" value={nextEntry.id}/><button className={styles.skip}>Pular p/ próxima <ArrowRight size={15}/></button></form> : null}
            </div>
          </div>


        </section>
      ) : entries.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">O ciclo precisa de uma matéria ativa</h2>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
            Verifique se as disciplinas e os assuntos deste guia estão ativos. Depois, volte aqui para continuar.
          </p>
          <Link href="/base" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-amber-200 dark:text-amber-950">
            Ver matérias
          </Link>
        </section>
      ) : null}

      <section className={styles.trail}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white"><Route size={20}/> Trilha sequencial do ciclo</h2>
          <details className="relative"><summary className="cursor-pointer text-xs text-textSecondary">Ações da trilha</summary><div className="absolute right-0 z-10 w-48 rounded-lg border bg-surface p-3">
            {entries.length > 0 ? (
              <form action={deleteAllCycleEntries}>
                <ConfirmSubmitButton
                  message="Excluir todas as posições do ciclo? O histórico de estudos será preservado."
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={16} />
                  Excluir todos
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div></details>
        </div>
        {displayEntries.length > 0 ? (
          <div className="space-y-1.5">
            {visibleEntries.map((entry) => {
              const isCurrent = entry.active && entry.orderIndex === currentOrder;
              const aggregate = aggMap.get(entry.id) ?? { questions: 0, correct: 0 };
              const pct = aggregate.questions > 0 ? aggregate.correct / aggregate.questions * 100 : 0;
              const status = statusForEntry(entry, currentOrder);
              return (
                <article key={entry.id} data-current={isCurrent} data-done={status === "CONCLUIDO"} className={`cycle-row relative grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-control border border-slate-200 bg-surface px-3 py-2 dark:border-white/5 lg:grid-cols-[32px_minmax(0,1fr)_auto] ${isCurrent ? "border-l-4 border-l-primary" : ""}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-control text-sm font-semibold ${isCurrent ? "bg-primary text-white" : "bg-slate-100 text-textSecondary dark:bg-elevated"}`}>
                      {status === "CONCLUIDO" ? <CircleCheckBig size={19} aria-label={`Posição ${entry.orderIndex} concluída`} /> : entry.orderIndex}
                    </span>
                    <div className="cycle-row-text min-w-0 flex-1">
                      <div className="cycle-row-labels"><p>{isCurrent ? "Agora · " : status === "CONCLUIDO" ? `#${entry.orderIndex} · ` : ""}{entry.subject.discipline.name}</p><span>Peso {entry.subject.weight.toFixed(1)}</span></div>
                      <p className="mt-0.5 text-sm font-semibold text-textPrimary">{entry.subject.name}</p>
                  </div><div className="cycle-row-metrics">{status === "CONCLUIDO" ? <><b>{pct.toFixed(0)}% acertos ({aggregate.correct}/{aggregate.questions})</b><small>Questões registradas</small></> : <><b>Estimado: {minutesForWeight(entry.subject.weight)} min</b><small>{entry.discipline?.questionGoal ?? settings.questionsPerSession} questões</small></>}</div><span className={"cycle-status " + statusChip(status)}>{status}</span>
                  <div className="cycle-row-actions col-span-2 flex items-center justify-end gap-2 lg:col-span-1">
                  {isCurrent ? <Link href="/registro" className="cycle-start">Iniciar <Play size={13}/></Link> : null}

                  <details className="relative min-w-0 rounded-control bg-elevated">
                    <summary className="grid min-h-11 w-11 cursor-pointer list-none place-items-center text-textSecondary"><span className="sr-only">Gerenciar posição #{entry.orderIndex}</span><GripVertical size={16} aria-hidden /></summary>
                    <div className="absolute right-0 top-full z-20 mt-1 flex w-64 flex-wrap gap-2 rounded-control border bg-surface p-3 shadow-soft">
                  <form className="cycle-continue" action={setCyclePosition}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button
                      disabled={!entry.active || isCurrent}
                      className="min-h-11 w-full rounded-control bg-elevated px-3 text-[11px] font-semibold text-primary disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800"
                    >
                      {isCurrent ? "Você continua daqui" : entry.active ? "Continuar daqui" : "Posição pausada"}
                    </button>
                  </form>
                      <form action={moveCycleEntry}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="direction" value="up" /><button className="min-h-11 rounded-control border px-3 text-sm">Subir</button></form>
                      <form action={toggleCycleEntry}><input type="hidden" name="entryId" value={entry.id} /><button className="min-h-11 rounded-control border px-3 text-sm">{entry.active ? "Pausar" : "Ativar"}</button></form>
                      <form action={duplicateCycleEntry}><input type="hidden" name="entryId" value={entry.id} /><button className="min-h-11 rounded-control border px-3 text-sm">Duplicar</button></form>
                      <form action={deleteCycleEntry}><input type="hidden" name="entryId" value={entry.id} /><ConfirmSubmitButton message="Excluir esta posição do ciclo? O histórico de estudos será preservado." className="min-h-11 rounded-control border border-rose-200 px-3 text-sm text-rose-700 dark:text-rose-300">Excluir</ConfirmSubmitButton></form>
                    </div>
                  </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen size={21} /></span>
            <h4 className="mt-4 text-lg font-semibold">Seu ciclo ainda está vazio</h4>
            <p className="mx-auto mt-1 max-w-md text-sm text-textSecondary">Importe sua planilha para criar matérias, assuntos e a ordem do ciclo de uma vez.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/base" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">Importar planilha</Link>
              <Link href="/ciclo?novo=1" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-white/10">Adicionar manualmente</Link>
            </div>
          </div>
        )}


      </section>

      <div className={styles.more}><Link href={`/ciclo?todas=${params?.todas==='1'?'0':'1'}`}>{params?.todas==='1'?'Mostrar trecho atual':'Ver todas as posições'} ({displayEntries.length})</Link><span>{totalQuestions} questões · {accuracy.toFixed(1)}% acertos</span><Link href="/estatisticas">Ver relatório completo →</Link></div>      <details className="rounded-control border border-slate-200 bg-surface px-4 py-2 dark:border-white/5 dark:bg-panelDark">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Gerenciar ordem e pesos do ciclo</summary>
          <details className="mt-3 rounded-control bg-elevated px-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-primary">
              Já comecei este ciclo — escolher de onde continuar
            </summary>
            <p className="mt-2 text-sm text-textSecondary dark:text-textSecondary">
              Use isto se você já estudou algumas matérias antes de entrar no StudyFlow. O ajuste não cria sessões nem altera suas estatísticas.
            </p>
            <form action={setCyclePosition} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                Próxima matéria a estudar
                <select
                  name="entryId"
                  defaultValue={currentCycle?.entry.id}
                  className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-surface px-3 text-sm dark:border-white/10 dark:bg-elevated"
                >
                  {activeEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      #{entry.orderIndex} — {entry.subject.discipline.name} / {entry.subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 text-sm font-semibold text-primary">
                <ArrowRight size={16} /> Continuar daqui
              </button>
            </form>
          </details>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 py-3 text-sm dark:border-white/5">
          <Link href="/debug/ciclo?simular=200" className="inline-flex min-h-11 items-center gap-2 rounded-control border px-4 font-semibold"><CircleCheckBig size={16} /> Analisar novamente</Link>
          <Link href="/api/cycle/export?total=200" className="inline-flex min-h-11 items-center gap-2 rounded-control border px-4 font-semibold"><Download size={16} /> Exportar ciclo</Link>
          <Link href={`/ciclo?novo=${showAdd ? "0" : "1"}`} className="inline-flex min-h-11 items-center gap-2 rounded-control border px-4 font-semibold"><Plus size={16} /> {showAdd ? "Fechar" : "Adicionar posição"}</Link>
        </div>
      </details>


    </div>
  );
}




