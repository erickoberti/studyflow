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
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  GripVertical,
  History,
  MoreVertical,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
  Zap,
} from "lucide-react";

function minutesForWeight(weight: number) {
  return Math.max(30, Number(weight) * 30);
}

function statusForEntry(entry: { active: boolean; orderIndex: number }, currentOrder: number | null) {
  if (!entry.active) {
    return {
      label: "AGUARDANDO",
      chip: "bg-[#22314f] text-slate-300",
    };
  }
  if (currentOrder !== null && entry.orderIndex < currentOrder) {
    return {
      label: "CONCLUÍDO",
      chip: "bg-emerald-500 text-white",
    };
  }
  if (currentOrder !== null && entry.orderIndex === currentOrder) {
    return {
      label: "ESTUDANDO",
      chip: "bg-primary text-white ring-2 ring-primary/30",
    };
  }
  return {
    label: "PENDENTE",
    chip: "bg-[#22314f] text-slate-300",
  };
}

function reviewVisual(discipline: string) {
  const value = discipline.toLowerCase();
  if (value.includes("mat") || value.includes("lóg")) {
    return { bg: "bg-orange-500/15", icon: "text-orange-400" };
  }
  if (value.includes("direito")) {
    return { bg: "bg-blue-500/15", icon: "text-blue-400" };
  }
  return { bg: "bg-purple-500/15", icon: "text-purple-400" };
}

function formatDatePtBr(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function CicloPage({
  searchParams,
}: {
  searchParams?: { novo?: string };
}) {
  const user = await requireUser();

  const [entries, subjects, aggregates, recentSessions] = await Promise.all([
    prisma.cycleEntry.findMany({
      where: { userId: user.id },
      include: { subject: { include: { discipline: true } } },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, active: true, discipline: { active: true } },
      include: { discipline: true },
      orderBy: [{ discipline: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.studySession.groupBy({
      by: ["cycleEntryId"],
      where: { userId: user.id },
      _sum: { questions: true, correct: true, estimatedMinutes: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id },
      take: 3,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        cycleEntry: { include: { subject: { include: { discipline: true } } } },
      },
    }),
  ]);

  const currentOrder = entries.find((e) => e.active)?.orderIndex ?? null;
  const showAdd = searchParams?.novo === "1";

  const aggMap = new Map(
    aggregates.map((a) => [
      a.cycleEntryId,
      {
        questions: a._sum.questions ?? 0,
        correct: a._sum.correct ?? 0,
      },
    ]),
  );

  const totalMinutes = entries.reduce((sum, e) => sum + minutesForWeight(e.subject.weight), 0);
  const totalQuestions = aggregates.reduce((sum, a) => sum + (a._sum.questions ?? 0), 0);
  const totalCorrect = aggregates.reduce((sum, a) => sum + (a._sum.correct ?? 0), 0);
  const productivity = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  const cycleNumber = Math.max(1, Math.ceil(entries.length / 6));

  const weeklyMinutes = aggregates.reduce((sum, a) => sum + (a._sum.estimatedMinutes ?? 0), 0);
  const weeklyTargetMinutes = Math.max(300, totalMinutes || 300);
  const weeklyTargetQuestions = Math.max(100, Math.round(entries.length * 25));
  const weeklyProgress = Math.min(100, (weeklyMinutes / Math.max(1, weeklyTargetMinutes)) * 100);

  const solvedProgress = Math.min(100, (totalQuestions / Math.max(1, weeklyTargetQuestions)) * 100);
  const reviewProgress = Math.min(100, (recentSessions.length / 10) * 100);

  return (
    <div className="space-y-8 pb-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">Gestão do Ciclo de Estudos</h1>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400 md:text-xl">Otimize sua rotina com o método de ciclos interativos.</p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700/70 dark:bg-[#1b2438] dark:text-slate-100 dark:hover:bg-[#25314c]">
            <History size={16} /> Histórico
          </button>
          <Link
            href={`/ciclo?novo=${showAdd ? "0" : "1"}`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:opacity-90"
          >
            <Plus size={16} /> {showAdd ? "Fechar" : "Novo Ciclo"}
          </Link>
        </div>
      </section>

      {showAdd ? (
        <section className="rounded-2xl border border-primary/30 bg-[#0f1629] p-5">
          <form action={addCycleEntry} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-slate-300">
              Assunto
              <select
                name="subjectId"
                defaultValue={subjects[0]?.id}
                className="mt-1.5 h-11 w-full rounded-lg border border-primary/30 bg-[#161f35] px-3 text-sm text-slate-100 outline-none"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.discipline.name} - {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-white">
              Adicionar ao ciclo
            </button>
          </form>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#0f1b33] dark:shadow-soft">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-base font-medium text-slate-600 dark:text-slate-300">Tempo Total</span>
            <span className="rounded-lg bg-primary/20 p-2 text-primary"><Clock3 size={15} /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-slate-900 dark:text-white md:text-5xl">{(totalMinutes / 60).toFixed(1)}h</p>
            <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400">+12%</p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#0f1b33] dark:shadow-soft">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-base font-medium text-slate-600 dark:text-slate-300">Ciclo Atual</span>
            <span className="rounded-lg bg-blue-500/20 p-2 text-blue-400"><RefreshCcw size={15} /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white md:text-4xl">Ciclo #{String(cycleNumber).padStart(2, "0")}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Em progresso</p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#0f1b33] dark:shadow-soft">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-base font-medium text-slate-600 dark:text-slate-300">Produtividade</span>
            <span className="rounded-lg bg-amber-500/20 p-2 text-amber-400"><Zap size={15} /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-slate-900 dark:text-white md:text-5xl">{productivity.toFixed(1)}%</p>
            <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400">+3%</p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#0f1b33] dark:shadow-soft">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-base font-medium text-slate-600 dark:text-slate-300">Matérias</span>
            <span className="rounded-lg bg-purple-500/20 p-2 text-purple-400"><BookOpen size={15} /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-slate-900 dark:text-white md:text-5xl">{entries.filter((e) => e.active).length}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Ativas no ciclo</p>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-primary/20 dark:bg-[#0f1b33] dark:shadow-soft">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-primary/20">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white md:text-4xl">Fila do Ciclo Atual</h3>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-1 text-emerald-400"><span className="size-2 rounded-full bg-emerald-400" /> Concluído</span>
            <span className="flex items-center gap-1 text-primary"><span className="size-2 rounded-full bg-primary" /> Atual</span>
            <span className="flex items-center gap-1 text-slate-400"><span className="size-2 rounded-full bg-slate-500" /> Pendente</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 dark:bg-[#14213a] dark:text-slate-400">
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Ordem</th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Matéria / Tópico</th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Duração</th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Progresso</th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-primary/15">
              {entries.map((entry) => {
                const agg = aggMap.get(entry.id) ?? { questions: 0, correct: 0 };
                const pct = agg.questions > 0 ? (agg.correct / agg.questions) * 100 : 0;
                const progress = currentOrder !== null && entry.orderIndex < currentOrder ? 100 : pct;
                const status = statusForEntry(entry, currentOrder);
                const isCurrent = currentOrder !== null && entry.orderIndex === currentOrder;
                const duration = minutesForWeight(entry.subject.weight);

                return (
                  <tr key={entry.id} className={isCurrent ? "bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-[#131f37]"}>
                    <td className="px-6 py-4">
                      <div
                        className={`flex size-10 items-center justify-center rounded-full text-xl font-black ${
                          progress >= 100
                            ? "bg-emerald-500/20 text-emerald-400"
                            : isCurrent
                              ? "bg-primary text-white"
                              : "bg-[#22314f] text-slate-400"
                        }`}
                      >
                        {String(entry.orderIndex).padStart(2, "0")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xl font-bold text-slate-900 dark:text-white md:text-3xl">{entry.subject.discipline.name}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 md:text-xl">{entry.subject.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xl font-semibold text-slate-900 dark:text-white md:text-3xl">{duration} min</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${status.chip}`}>{status.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex w-44 items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#26385a]">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                        <span className="text-base font-bold text-slate-900 dark:text-white md:text-2xl">{Math.round(progress)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <form action={moveCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button className="rounded-md p-2 text-slate-400 hover:bg-[#243556]" title="Subir">
                            <GripVertical size={16} />
                          </button>
                        </form>
                        <form action={duplicateCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded-md p-2 text-slate-400 hover:bg-[#243556]" title="Duplicar">
                            <Copy size={16} />
                          </button>
                        </form>
                        {isCurrent ? (
                          <form action={toggleCycleEntry}>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <button className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white hover:opacity-90" title="Avançar">
                              <Play size={12} /> RESUMIR
                            </button>
                          </form>
                        ) : (
                          <form action={toggleCycleEntry}>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <button className="rounded-md p-2 text-slate-400 hover:bg-[#243556]" title="Ativar/Inativar">
                              <MoreVertical size={16} />
                            </button>
                          </form>
                        )}
                        <form action={deleteCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded-md p-2 text-red-400 hover:bg-red-500/15" title="Excluir">
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

        <div className="border-t border-slate-200 bg-slate-50 p-5 text-center dark:border-primary/20 dark:bg-[#12203b]">
          <button className="inline-flex items-center gap-2 text-base font-bold text-primary hover:underline">
            <ChevronDown size={16} /> Ver todas as matérias do ciclo
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white md:text-4xl">Meta Semanal</h3>
            <span className="text-xl font-bold text-primary md:text-2xl">{weeklyProgress.toFixed(0)}% Completo</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-primary/20 dark:bg-[#0f1b33] dark:shadow-soft">
            <div className="space-y-7">
              <div>
                <div className="mb-2 flex justify-between text-lg md:text-2xl">
                  <span className="font-bold text-slate-900 dark:text-white">Tempo de Estudo Líquido</span>
                  <span className="font-bold text-slate-400">{Math.round(weeklyMinutes / 60)}h / {Math.round(weeklyTargetMinutes / 60)}h</span>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#23324f]">
                  <div className="h-full bg-primary" style={{ width: `${weeklyProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-lg md:text-2xl">
                  <span className="font-bold text-slate-900 dark:text-white">Questões Resolvidas</span>
                  <span className="font-bold text-slate-400">{totalQuestions} / {weeklyTargetQuestions}</span>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#23324f]">
                  <div className="h-full bg-blue-500" style={{ width: `${solvedProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-lg md:text-2xl">
                  <span className="font-bold text-slate-900 dark:text-white">Revisões Realizadas</span>
                  <span className="font-bold text-slate-400">{recentSessions.length} / 10</span>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#23324f]">
                  <div className="h-full bg-emerald-500" style={{ width: `${reviewProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-3xl font-black text-slate-900 dark:text-white md:text-4xl">Últimas Revisões</h3>
          <div className="space-y-3">
            {recentSessions.map((session) => {
              const visual = reviewVisual(session.cycleEntry.subject.discipline.name);
              return (
                <div
                  key={session.id}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-primary/50 dark:border-primary/20 dark:bg-[#0f1b33]"
                >
                  <div className={`flex size-11 items-center justify-center rounded-lg ${visual.bg} ${visual.icon}`}>
                    <BookOpen size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xl font-bold text-slate-900 dark:text-white md:text-2xl">{session.cycleEntry.subject.discipline.name}</p>
                    <p className="text-base text-slate-400">{formatDatePtBr(session.date)}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              );
            })}
            {recentSessions.length === 0 ? (
              <p className="rounded-xl border border-primary/20 bg-[#0f1b33] p-4 text-sm text-slate-400">Sem revisões recentes.</p>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 px-6 py-8 text-center dark:border-primary/20">
        <p className="text-sm text-slate-500 dark:text-slate-400">© 2024 StudyFlow - Plataforma de Gestão de Ciclos de Estudo</p>
        <div className="mt-4 flex justify-center gap-6">
          <a className="text-xs font-semibold text-slate-400 hover:text-primary" href="#">Termos de Uso</a>
          <a className="text-xs font-semibold text-slate-400 hover:text-primary" href="#">Privacidade</a>
          <a className="text-xs font-semibold text-slate-400 hover:text-primary" href="#">Suporte</a>
        </div>
      </footer>
    </div>
  );
}

