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
import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { cycleService } from "@/lib/cycle-service";
import { getCycleProgram } from "@/lib/programmed-cycle-service";
import { ProgrammedCycleScreen } from "@/components/programmed-cycle-screen";
import {
  ArrowRight,
  BookOpen,
  CircleCheckBig,
  Route,
  Download,
  GripVertical,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

function minutesForWeight(weight: number) {
  return Math.max(30, Number(weight) * 30);
}

export default async function CicloPage({
  searchParams,
}: {
  searchParams?: Promise<{ novo?: string; ajuste?: string; todas?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const program = await getCycleProgram(user.id, guide.id);
  if (program) return <ProgrammedCycleScreen program={program} userId={user.id} studyGuideId={guide.id} adjustment={params?.ajuste} />;
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));

  const [entries, subjects, aggregates, settings, cycleState, weeklyAggregate, currentCycle] = await Promise.all([
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
    prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: guide.id }, select: { currentOrderIndex: true, roundNumber: true } }),
    prisma.studySession.aggregate({ where: { userId: user.id, studyGuideId: guide.id, date: { gte: weekStart } }, _sum: { questions: true } }),
    cycleService.getCurrent(user.id, guide.id),
  ]);
  const cycleSuggestions = await cycleService.preview(user.id, guide.id, entries.length);

  const showAdd = params?.novo === "1";
  const suggestionByEntry = new Map(cycleSuggestions.map((item) => [item.entryId, item]));
  const displayEntries = entries.map((entry) => {
    const suggestion = suggestionByEntry.get(entry.id);
    return {
      ...entry,
      subject: {
        name: suggestion?.subject.name ?? (!entry.active ? entry.subject?.name : null) ?? "Sem assunto ativo",
        weight: suggestion?.subject.weight ?? entry.subject?.weight ?? 1,
        discipline: { name: suggestion?.discipline.name ?? entry.discipline?.name ?? entry.subject?.discipline.name ?? "Matéria" },
      },
    };
  });
  const currentOrder = currentCycle?.entry.orderIndex ?? null;
  const activeEntries = displayEntries.filter((entry) => entry.active && suggestionByEntry.has(entry.id));
  const currentIndex = activeEntries.findIndex((entry) => entry.orderIndex === currentOrder);
  const nextSuggestion = cycleSuggestions[1];
  const nextEntry = nextSuggestion ? displayEntries.find((entry) => entry.id === nextSuggestion.entryId) : null;
  const positionProgress = currentIndex < 0 ? 0 : currentIndex / activeEntries.length * 100;
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

  return (
    <div className={`${shell.screen} ${styles.screen}`}>
      <GuideSetupNotice name={guide.name} {...guide._count} />
      <header className={styles.header}>
        <p className={styles.eyebrow}>Seu roteiro · volta {cycleState?.roundNumber ?? 1}</p>
        <h1>Ciclo de estudos</h1>
        <p>Seu ponto atual e toda a sequência.</p>
        <Link href="/ciclo/configuracao" className="sf-secondary mt-3">Planejar quatro voltas · comparar antes de ativar</Link>
      </header>
      {showAdd && subjects.length > 0 ? (
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
                  {subject.discipline.name} → {subject.name}
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
          <div className={styles.currentStudy}>
            <div>
              <p className={styles.eyebrow}>Agora · posição #{currentCycle.entry.orderIndex}</p>
              <h2>{currentCycle.entry.discipline.name} <span>→ {currentCycle.subject.name}</span></h2>
              <div className={styles.heroFacts}>
                <span>{currentCycle.entry.discipline.questionGoal} questões</span>
                <span>~{minutesForWeight(currentCycle.subject.weight)} min · peso {currentCycle.subject.weight.toFixed(1)}</span>
                <span>Último estudo nesta posição: {lastStudiedAt ? lastStudiedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem registro"}</span>
              </div>
            </div>
            <div className={styles.heroActions}>
            <Link
              href="/registro"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft"
            >
              <Play size={17} fill="currentColor" /> Continuar estudo
            </Link>
            {nextEntry ? <form action={setCyclePosition}><input type="hidden" name="entryId" value={nextEntry.id}/><button className={styles.skip} aria-label="Pular para a próxima posição"><span className={styles.skipLabel}>Pular para a próxima</span><span className={styles.skipShort}>Pular</span><ArrowRight size={15}/></button></form> : null}
            </div>
          </div>
          <div className={styles.nextStudy}>
            <span>A seguir{nextSuggestion && nextSuggestion.orderIndex <= currentCycle.entry.orderIndex ? " · próxima volta" : ""}</span>
            <p>{nextEntry ? <>{nextEntry.subject.discipline.name} <span>→</span> {nextEntry.subject.name}</> : "Ao concluir, este roteiro recomeça com uma nova seleção de assunto."}</p>
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

      {activeEntries.length > 0 ? <section className={styles.progress} aria-label="Percurso da volta">
        <div><strong>Posição {currentIndex + 1} de {activeEntries.length}</strong><span>{currentIndex} anteriores · {activeEntries.length - currentIndex - 1} a seguir</span></div>
        <div role="progressbar" aria-label="Percurso da volta" aria-valuemin={0} aria-valuemax={activeEntries.length} aria-valuenow={currentIndex} aria-valuetext={`${currentIndex} posições antes da atual; posição ${currentIndex + 1} de ${activeEntries.length}`}><i style={{width: `${positionProgress}%`}} /></div>
        <p>Percurso por posição; ao final, uma nova volta começa.</p>
      </section> : null}
      <section className={styles.trail} id="sequencia" aria-labelledby="cycle-sequence-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="cycle-sequence-title"><Route size={20}/> Sequência completa <span>({displayEntries.length})</span></h2><p className={styles.trailHint}>Assuntos previstos pela ordem e pelos pesos. A seleção se atualiza após cada estudo.</p></div>
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
          <ol className={styles.sequence}>
            {displayEntries.map((entry) => {
              const aggregate = aggregates.find(item => item.cycleEntryId === entry.id);
              const questions = aggregate?._sum.questions ?? 0;
              const correct = aggregate?._sum.correct ?? 0;
              const isCurrent = entry.active && entry.orderIndex === currentOrder;
              const isNext = entry.id === nextEntry?.id;
              const available = entry.active && suggestionByEntry.has(entry.id);
              const status = !entry.active ? "Pausada" : !available ? "Indisponível" : isCurrent ? "Agora" : isNext ? "A seguir" : currentOrder !== null && entry.orderIndex < currentOrder ? "Anterior" : "Na sequência";
              return (
                <li key={entry.id} data-current={isCurrent} data-next={isNext} aria-current={isCurrent ? "step" : undefined} className={styles.row}>
                  <span className={styles.position}>{entry.orderIndex}</span>
                  <div className={styles.rowText}>
                    <p><strong>{entry.subject.discipline.name}</strong> <span aria-hidden>→</span> {entry.subject.name}</p>
                    <small>{available ? `Peso ${entry.subject.weight.toFixed(1)} · ~${minutesForWeight(entry.subject.weight)} min · ${entry.discipline?.questionGoal ?? settings.questionsPerSession} questões` : !entry.active ? "Fora da sequência ativa" : "Ative a matéria e cadastre um assunto para estudar"}</small>
                    {questions > 0 ? <small>Histórico: {questions} questões · {correct} acertos ({(correct / questions * 100).toFixed(0)}%)</small> : null}
                  </div>
                  <span className={styles.status}>{status}</span>
                  <div className={styles.rowActions}>

                  <details className="relative min-w-0 rounded-control bg-elevated">
                    <summary className="grid min-h-11 w-11 cursor-pointer list-none place-items-center text-textSecondary"><span className="sr-only">Gerenciar posição #{entry.orderIndex}</span><GripVertical size={16} aria-hidden /></summary>
                    <div className="absolute right-0 top-full z-20 mt-1 flex w-64 flex-wrap gap-2 rounded-control border bg-surface p-3 shadow-soft">
                  <form className="cycle-continue" action={setCyclePosition}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button
                      disabled={!available || isCurrent}
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
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen size={21} /></span>
            <h4 className="mt-4 text-lg font-semibold">Seu ciclo ainda está vazio</h4>
            <p className="mx-auto mt-1 max-w-md text-sm text-textSecondary">Adicione matérias para começar ou monte o ciclo com as que já estão salvas em Guias. Detalhar assuntos é opcional.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/base?import=1" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">Importar planilha</Link>
              <Link href={guide._count.disciplines ? "/guias" : "/base?tab=disciplinas&novo=1"} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-white/10">{guide._count.disciplines ? "Montar ciclo com minhas matérias" : "Adicionar matéria"}</Link>
            </div>
          </div>
        )}


      </section>

      <section className={styles.summary} aria-label="Histórico e meta semanal">
        <p><strong>{(totalMinutes / 60).toFixed(1)}h</strong> de estudo · <strong>{totalQuestions}</strong> questões · {accuracy.toFixed(1)}% de acertos</p>
        <p>Meta semanal: <strong>{weeklyQuestions}/{weeklyGoal}</strong> questões ({weeklyProgress.toFixed(0)}%)</p>
        <Link href="/estatisticas">Ver estatísticas <ArrowRight size={15}/></Link>
      </section>
      <details className="rounded-control border border-slate-200 bg-surface px-4 py-2 dark:border-white/5 dark:bg-panelDark">
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




