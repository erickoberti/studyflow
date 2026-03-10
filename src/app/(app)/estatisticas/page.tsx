import { CalendarDays, Download, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics";

function trendIcon(value: number) {
  if (value >= 80) return <TrendingUp size={16} className="text-emerald-500" />;
  if (value >= 65) return <span className="text-slate-400">→</span>;
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
  const dashboard = await getDashboardData(user.id);

  const topSubjects = dashboard.subjectStats.slice(0, 5);
  const week = dashboard.byDay.slice(-7);
  const maxWeek = Math.max(1, ...week.map((d) => d.questions));

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white">Desempenho Geral</h1>
          <p className="mt-1 text-xl text-slate-500 dark:text-slate-400">Acompanhe sua evolução nos estudos nos últimos 30 dias.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-panelDark dark:text-slate-200">
            <CalendarDays size={16} className="text-slate-400" /> 01 Out - 31 Out, 2023
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-soft">
            <Download size={16} /> Exportar Dados
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <p className="text-sm font-medium text-slate-500">Tempo Total</p>
          <p className="mt-2 text-5xl font-black text-slate-900 dark:text-white">{(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h</p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">+12%</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <p className="text-sm font-medium text-slate-500">Precisão Média</p>
          <p className="mt-2 text-5xl font-black text-slate-900 dark:text-white">{dashboard.totals.overallPercentage.toFixed(1)}%</p>
          <span className="mt-3 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">-2.4%</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <p className="text-sm font-medium text-slate-500">Questões Totais</p>
          <p className="mt-2 text-5xl font-black text-slate-900 dark:text-white">{dashboard.totals.totalQuestions}</p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">+5%</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <p className="text-sm font-medium text-slate-500">Meta Concluída</p>
          <p className="mt-2 text-5xl font-black text-slate-900 dark:text-white">{dashboard.totals.targetPercentage.toFixed(0)}%</p>
          <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600">+10%</span>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-10">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark xl:col-span-7">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">Atividade Semanal</h3>
            <span className="text-sm font-semibold text-slate-500">Média: 6.2h/dia</span>
          </div>
          <div className="flex h-64 items-end justify-between gap-4 px-2">
            {week.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-primary/25" style={{ height: `${Math.max(15, (day.questions / maxWeek) * 100)}%` }} />
                <span className="text-xs font-medium text-slate-500">{day.date.slice(8, 10)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark xl:col-span-3">
          <h3 className="mb-5 text-3xl font-black text-slate-900 dark:text-white">Precisão por Matéria</h3>
          <div className="space-y-5">
            {dashboard.disciplineStats.slice(0, 5).map((item) => (
              <div key={item.discipline}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.discipline}</span>
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
        <div className="border-b border-slate-200 p-6 dark:border-slate-800">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">Estatísticas Detalhadas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 font-bold">Disciplina</th>
                <th className="px-6 py-4 font-bold">Tempo Estudado</th>
                <th className="px-6 py-4 font-bold">Questões</th>
                <th className="px-6 py-4 font-bold">Precisão %</th>
                <th className="px-6 py-4 font-bold">Tendência</th>
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
        <div className="border-t border-slate-200 bg-slate-50/60 p-4 text-center text-sm font-bold text-primary dark:border-slate-800 dark:bg-slate-800/30">
          Ver relatório completo
        </div>
      </section>
    </div>
  );
}




