import shell from "@/components/official-shell.module.css";
import visual from "@/components/resource-screens.module.css";
import { CalendarDays, Download, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics";
import { requireActiveStudyGuide } from "@/lib/study-guide";

function dayKeyInSaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function trendIcon(value: number) {
  if (value >= 80) return <TrendingUp size={16} className="text-emerald-500" />;
  if (value >= 65) return <span className="text-textSecondary">→</span>;
  return <TrendingDown size={16} className="text-rose-500" />;
}

function barColor(value: number) {
  if (value >= 85) return "bg-emerald-500";
  if (value >= 70) return "bg-primary";
  if (value >= 55) return "bg-amber-500";
  return "bg-rose-500";
}

export default async function EstatisticasPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const dashboard = await getDashboardData(user.id, guide.id);

  const topSubjects = dashboard.subjectStats.slice(0, 5);
  const byDayMap = new Map(dashboard.byDay.map((day) => [day.date, day]));
  const week = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = dayKeyInSaoPaulo(date);
    const day = byDayMap.get(key);

    return {
      date: key,
      questions: day?.questions ?? 0,
    };
  });
  const maxWeek = Math.max(1, ...week.map((day) => day.questions));
  const avgQuestionsPerDay = week.reduce((sum, day) => sum + day.questions, 0) / week.length;
  const calendar = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (27 - index)); const key = dayKeyInSaoPaulo(date); const value = byDayMap.get(key)?.questions ?? 0;
    return { key, value, label: date.getDate() };
  });

  return (
    <div className={`${shell.screen} ${visual.page} ${visual.statistics} space-y-5`}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Desempenho Geral</h1>
          <p className="mt-1 text-sm text-textSecondary dark:text-textSecondary">
            Resultados acumulados do guia, com atividade semanal e consistência nos últimos 28 dias.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-panelDark dark:text-slate-200">
            <CalendarDays size={16} className="text-textSecondary" /> {guide.name}
          </div>
          <a href="/api/export/csv" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-soft">
            <Download size={16} /> Exportar Dados
          </a>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark">
          <p className="text-sm font-medium text-textSecondary">Tempo Total</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h
          </p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">
            Tempo registrado
          </span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark">
          <p className="text-sm font-medium text-textSecondary">Precisão média</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {dashboard.totals.overallPercentage.toFixed(1)}%
          </p>
          <span className="mt-3 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
            Acertos / questões
          </span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark">
          <p className="text-sm font-medium text-textSecondary">Questões totais</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{dashboard.totals.totalQuestions}</p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">
            Questões registradas
          </span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark">
          <p className="text-sm font-medium text-textSecondary">Meta de acerto</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {dashboard.totals.targetPercentage.toFixed(0)}%
          </p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">
            Meta configurada
          </span>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark">
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-semibold text-slate-900 dark:text-white">Consistência</h3><p className="text-sm text-textSecondary">Últimos 28 dias de estudo</p></div><span className="text-sm font-bold text-primary">Sequência: {dashboard.totals.streakDays} dias</span></div>
        <div className="stats-calendar">{calendar.map((day) => <div key={day.key} title={`${day.key}: ${day.value} questões`} className={`aspect-square rounded-lg p-1 text-center text-[10px] font-bold ${day.value === 0 ? "bg-slate-100 text-textSecondary dark:bg-elevated" : day.value < 20 ? "bg-primary/25 text-primary" : "bg-primary text-white"}`}><span>{day.label}</span><span className="block text-[9px]">{day.value || "–"}</span></div>)}</div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-10">
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark xl:col-span-7">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Atividade Semanal</h3>
            <span className="text-sm font-semibold text-textSecondary">Média: {avgQuestionsPerDay.toFixed(1)} questões/dia</span>
          </div>
          <div className="flex h-56 items-end justify-between gap-3 px-1">
            {week.map((day) => (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-primary/25"
                    title={`${day.questions} questões`}
                    style={{ height: `${(day.questions / maxWeek) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-textSecondary">{day.date.slice(8, 10)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-panelDark xl:col-span-3">
          <h3 className="mb-5 text-xl font-semibold text-slate-900 dark:text-white">Precisão por matéria</h3>
          <div className="space-y-4">
            {dashboard.disciplineStats.slice(0, 5).map((item) => (
              <div key={item.discipline}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-textSecondary">{item.discipline}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.percentage.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={`h-2 rounded-full ${barColor(item.percentage)}`} style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-sm dark:border-white/5 dark:bg-panelDark">
        <div className="border-b border-slate-200 p-5 dark:border-white/5">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Estatísticas detalhadas</h3>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
          {topSubjects.map((item) => <article key={`${item.discipline}-${item.subject}`} className="p-4">
            <p className="font-semibold text-slate-900 dark:text-white">{item.discipline}</p>
            <p className="text-sm text-textSecondary">{item.subject}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-textSecondary">Tempo</dt><dd className="font-semibold">{(item.estimatedMinutes / 60).toFixed(1)}h</dd></div><div><dt className="text-xs text-textSecondary">Questões</dt><dd className="font-semibold">{item.questions}</dd></div><div><dt className="text-xs text-textSecondary">Precisão</dt><dd className="font-semibold">{item.percentage.toFixed(1)}%</dd></div></dl>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-textSecondary dark:bg-elevated/50">
              <tr>
                <th className="px-6 py-4 font-bold">Disciplina</th>
                <th className="px-6 py-4 font-bold">Tempo Estudado</th>
                <th className="px-6 py-4 font-bold">Questões</th>
                <th className="px-6 py-4 font-bold">Precisão %</th>
                <th className="px-6 py-4 font-bold">Faixa de precisão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {topSubjects.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.discipline}</td>
                  <td className="px-6 py-4">{(item.estimatedMinutes / 60).toFixed(1)}h</td>
                  <td className="px-6 py-4">{item.questions}</td>
                  <td className="px-6 py-4 font-bold">{item.percentage.toFixed(1)}%</td>
                  <td className="px-6 py-4">{trendIcon(item.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50/60 p-4 text-center text-sm font-bold text-primary dark:border-white/5 dark:bg-elevated/30">
          <a href="/registros">Ver histórico completo →</a>
        </div>
      </section>
    </div>
  );
}
