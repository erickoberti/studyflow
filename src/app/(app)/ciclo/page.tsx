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
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import { getCyclePositionSuggestions } from "@/lib/cycle-strategy";
import { cycleService } from "@/lib/cycle-service";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  GripVertical,
  Play,
  Plus,
  Rocket,
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
  return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

export default async function CicloPage({
  searchParams,
}: {
  searchParams?: { novo?: string; ajuste?: string };
}) {
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
    }),
    getStudyGuideSettings(user.id, guide.id),
    getCyclePositionSuggestions(user.id, guide.id),
    prisma.studyGuideCycleState.findUnique({ where: { studyGuideId: guide.id }, select: { currentOrderIndex: true, roundNumber: true } }),
    prisma.studySession.aggregate({ where: { userId: user.id, studyGuideId: guide.id, date: { gte: weekStart } }, _sum: { questions: true } }),
    cycleService.getCurrent(user.id, guide.id),
  ]);

  const showAdd = searchParams?.novo === "1";
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
  const adjustmentMessage =
    searchParams?.ajuste === "ok"
      ? "Ponto do ciclo atualizado. A próxima sessão começará daqui."
      : searchParams?.ajuste === "sessao-ativa"
        ? "Finalize ou cancele a sessão em andamento antes de mudar o ponto do ciclo."
        : searchParams?.ajuste === "invalido"
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
    <div className="space-y-6 pb-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Meu Ciclo de Estudos</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Acompanhamento do progresso atual por disciplina e metas.
          </p>
        </div>
        <Link
          href={`/ciclo?novo=${showAdd ? "0" : "1"}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft"
        >
          <Plus size={16} /> {showAdd ? "Fechar" : "Novo Ciclo"}
        </Link>
      </section>

      {showAdd ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark">
          <form action={addCycleEntry} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Assunto
              <select
                name="subjectId"
                defaultValue={subjects[0]?.id}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
            searchParams?.ajuste === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {adjustmentMessage}
        </p>
      ) : null}

      {currentCycle ? (
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Continue seu ciclo</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                {currentCycle.entry.discipline.name} <span className="text-slate-300 dark:text-slate-600">→</span>{" "}
                {currentCycle.subject.name}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Posição #{currentCycle.entry.orderIndex} · volta {currentCycle.roundNumber}. O StudyFlow continuará deste ponto.
              </p>
            </div>
            <Link
              href="/registro"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-soft"
            >
              <Play size={17} fill="currentColor" /> Estudar agora
            </Link>
          </div>

          <details className="mt-5 rounded-xl border border-primary/15 bg-white/70 p-4 dark:bg-slate-900/40">
            <summary className="cursor-pointer list-none text-sm font-black text-primary">
              Já comecei este ciclo — escolher de onde continuar
            </summary>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Use isto se você já estudou algumas matérias antes de entrar no StudyFlow. O ajuste não cria sessões nem altera suas estatísticas.
            </p>
            <form action={setCyclePosition} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                Próxima matéria a estudar
                <select
                  name="entryId"
                  defaultValue={currentCycle.entry.id}
                  className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {activeEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      #{entry.orderIndex} — {entry.subject.discipline.name} / {entry.subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 text-sm font-black text-primary">
                <ArrowRight size={16} /> Continuar daqui
              </button>
            </form>
          </details>
        </section>
      ) : entries.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h2 className="text-lg font-black text-amber-900 dark:text-amber-100">O ciclo precisa de uma matéria ativa</h2>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
            Verifique se as disciplinas e os assuntos deste guia estão ativos. Depois, volte aqui para continuar.
          </p>
          <Link href="/base" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white dark:bg-amber-200 dark:text-amber-950">
            Ver matérias
          </Link>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Horas Totais</span>
            <Clock3 size={16} className="text-primary" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{(totalMinutes / 60).toFixed(1)}h</p>
            <span className="text-xs font-bold text-slate-400">Acumulado</span>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Meta Semanal</span>
            <Target size={16} className="text-primary" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{weeklyProgress.toFixed(0)}%</p>
            <span className="text-xs font-bold text-slate-400">{weeklyQuestions}/{weeklyGoal} questões</span>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Voltas concluídas</span>
            <GripVertical size={16} className="text-primary" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{Math.max(0, (cycleState?.roundNumber ?? 1) - 1)}</p>
            <span className="text-xs font-bold text-slate-400">Volta atual {cycleState?.roundNumber ?? 1}</span>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Tabela de Gerenciamento</h3>
          <div className="flex items-center gap-3 text-sm font-bold">
            {entries.length > 0 ? (
              <form action={deleteAllCycleEntries}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={16} />
                  Excluir todos
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {displayEntries.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
            {displayEntries.map((entry) => {
              const isCurrent = entry.active && entry.orderIndex === currentOrder;
              return (
                <article key={entry.id} className={`p-4 ${isCurrent ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${isCurrent ? "bg-primary text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                      {entry.orderIndex}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-950 dark:text-white">{entry.subject.discipline.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{entry.subject.name}</p>
                    </div>
                    {isCurrent ? <span className="rounded-lg bg-primary/15 px-2 py-1 text-[10px] font-black uppercase text-primary">Agora</span> : null}
                  </div>
                  <form action={setCyclePosition} className="mt-3">
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button
                      disabled={!entry.active || isCurrent}
                      className="min-h-11 w-full rounded-xl border border-primary/25 bg-primary/10 px-4 text-sm font-black text-primary disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800"
                    >
                      {isCurrent ? "Você continua daqui" : entry.active ? "Continuar daqui" : "Posição pausada"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen size={21} /></span>
            <h4 className="mt-4 text-lg font-black">Seu ciclo ainda está vazio</h4>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Importe sua planilha para criar matérias, assuntos e a ordem do ciclo de uma vez.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/base" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white">Importar planilha</Link>
              <Link href="/ciclo?novo=1" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black dark:border-slate-700">Adicionar manualmente</Link>
            </div>
          </div>
        )}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 font-bold">Disciplina / Assunto</th>
                <th className="px-4 py-3 font-bold">Progresso</th>
                <th className="px-4 py-3 font-bold">Tempo</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayEntries.map((entry) => {
                const aggregate = aggMap.get(entry.id) ?? { questions: 0, correct: 0 };
                const pct = aggregate.questions > 0 ? (aggregate.correct / aggregate.questions) * 100 : 0;
                const status = statusForEntry(entry, currentOrder);
                const timeLabel = `${Math.floor(minutesForWeight(entry.subject?.weight ?? 1) / 60)}h ${String(
                  minutesForWeight(entry.subject?.weight ?? 1) % 60,
                ).padStart(2, "0")}min`;
                const color =
                  entry.orderIndex % 3 === 0 ? "bg-orange-500" : entry.orderIndex % 2 === 0 ? "bg-purple-500" : "bg-blue-500";
                const progressColor =
                  entry.orderIndex % 3 === 0 ? "bg-orange-500" : entry.orderIndex % 2 === 0 ? "bg-purple-500" : "bg-blue-500";

                return (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-2 rounded-full ${color}`} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white">
                              {entry.subject?.discipline.name ?? "Disciplina"}
                            </p>
                            <span className="text-xs text-slate-300 dark:text-slate-600">/</span>
                            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{entry.subject?.name ?? "Assunto selecionado automaticamente"}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            Ordem #{entry.orderIndex} • Peso {entry.subject.weight}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full max-w-[220px]">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium text-slate-600 dark:text-slate-300">{pct.toFixed(0)}%</span>
                          <span className="italic text-slate-400">Meta: {settings.targetPercentage.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className={`h-2 rounded-full ${progressColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{timeLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusChip(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <form action={setCyclePosition}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button
                            disabled={!entry.active || entry.orderIndex === currentOrder}
                            className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-black text-primary disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800"
                            title="Definir como próxima posição do ciclo"
                          >
                            {entry.orderIndex === currentOrder ? "Atual" : "Continuar daqui"}
                          </button>
                        </form>
                        <form action={moveCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button className="rounded p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Subir">
                            <GripVertical size={16} />
                          </button>
                        </form>
                        <form action={toggleCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Alternar status">
                            <Play size={16} />
                          </button>
                        </form>
                        <form action={duplicateCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Duplicar">
                            <CalendarDays size={16} />
                          </button>
                        </form>
                        <form action={deleteCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button
                            className="rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Excluir ciclo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-xl bg-gradient-to-br from-primary to-primarySoft p-5 text-white shadow-soft">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white/20">
              <Rocket size={24} />
            </div>
            <div>
              <h4 className="text-2xl font-black">Pronto para a proxima meta?</h4>
              <p className="mt-2 text-sm text-white/90">
                Seu desempenho esta acima da media. Considere revisar temas mais complexos hoje.
              </p>
              <Link href="/registro" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary">
                Iniciar Cronometro
              </Link>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-xl font-black text-slate-900 dark:text-white">Resumo Diario</h4>
            <span className="text-xs font-bold uppercase text-primary">Hoje</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Tempo de Estudo Ativo</span>
              <span className="font-bold">{(totalMinutes / 60).toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Questoes Resolvidas</span>
              <span className="font-bold">{totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Taxa de Acerto</span>
              <span className="font-bold text-emerald-500">{accuracy.toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link href="/estatisticas" className="text-sm font-bold text-primary hover:underline">
              Ver relatorio completo →
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
