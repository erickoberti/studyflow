import Link from "next/link";
import {
  addCycleEntry,
  deleteCycleEntry,
  duplicateCycleEntry,
  moveCycleEntry,
  toggleCycleEntry,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";
import {
  CalendarDays,
  Clock3,
  GripVertical,
  MoreVertical,
  Play,
  Plus,
  Rocket,
  Target,
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
  searchParams?: { novo?: string };
}) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);

  const [entries, subjects, aggregates, settings] = await Promise.all([
    prisma.cycleEntry.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      include: { subject: { include: { discipline: true } } },
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
  ]);

  const showAdd = searchParams?.novo === "1";
  const aggMap = new Map(
    aggregates.map((aggregate) => [
      aggregate.cycleEntryId,
      {
        questions: aggregate._sum.questions ?? 0,
        correct: aggregate._sum.correct ?? 0,
      },
    ]),
  );

  const currentOrder = entries.find((entry) => entry.active)?.orderIndex ?? null;
  const totalMinutes = aggregates.reduce((sum, aggregate) => sum + (aggregate._sum.estimatedMinutes ?? 0), 0);
  const totalQuestions = aggregates.reduce((sum, aggregate) => sum + (aggregate._sum.questions ?? 0), 0);
  const totalCorrect = aggregates.reduce((sum, aggregate) => sum + (aggregate._sum.correct ?? 0), 0);
  const weeklyGoal = Math.max(1, settings.weeklyQuestionsGoal);
  const weeklyProgress = Math.min(100, (totalQuestions / weeklyGoal) * 100);
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Horas Totais</span>
            <Clock3 size={16} className="text-primary" />
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{(totalMinutes / 60).toFixed(1)}h</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">+12%</span>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Meta Semanal</span>
            <Target size={16} className="text-primary" />
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{weeklyProgress.toFixed(0)}%</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">+5%</span>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Ciclos Feitos</span>
            <GripVertical size={16} className="text-primary" />
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{Math.max(1, Math.ceil(entries.length / 3))}</p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">-2%</span>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Tabela de Gerenciamento</h3>
          <div className="flex items-center gap-5 text-sm font-bold">
            <button className="text-slate-600 dark:text-slate-300">Filtrar</button>
            <button className="text-primary">Exportar</button>
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {entries.map((entry) => {
                const aggregate = aggMap.get(entry.id) ?? { questions: 0, correct: 0 };
                const pct = aggregate.questions > 0 ? (aggregate.correct / aggregate.questions) * 100 : 0;
                const status = statusForEntry(entry, currentOrder);
                const timeLabel = `${Math.floor(minutesForWeight(entry.subject.weight) / 60)}h ${String(
                  minutesForWeight(entry.subject.weight) % 60,
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
                              {entry.subject.discipline.name}
                            </p>
                            <span className="text-xs text-slate-300 dark:text-slate-600">/</span>
                            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{entry.subject.name}</p>
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
                          <button className="rounded p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Mais opcoes">
                            <MoreVertical size={16} />
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
