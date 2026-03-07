import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function levelColor(value: number) {
  if (value >= 80) return "text-emerald-500 dark:text-emerald-300";
  if (value >= 70) return "text-amber-500 dark:text-amber-300";
  return "text-red-500 dark:text-red-300";
}

function barColor(value: number) {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 70) return "bg-amber-500";
  return "bg-red-500";
}

export default async function EstatisticasPage() {
  const user = await requireUser();
  const dashboard = await getDashboardData(user.id);

  const weakest = [...dashboard.subjectStats].sort((a, b) => a.percentage - b.percentage).slice(0, 8);
  const maxQuestions = Math.max(1, ...dashboard.byDay.map((item) => item.questions));
  const heatmap = dashboard.byDay.slice(-84);
  const weekly = dashboard.byDay.slice(-7);

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <header>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Análise de Performance</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Dados consolidados do seu progresso acadêmico nos últimos 30 dias.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-primary/10">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Total de horas</p>
          <h2 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">{(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-primary/10">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Precisão média</p>
          <h2 className={`mt-2 text-4xl font-black ${levelColor(dashboard.totals.overallPercentage)}`}>{pct(dashboard.totals.overallPercentage)}</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-primary/10">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Questões</p>
          <h2 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">{dashboard.totals.totalQuestions}</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-primary/10">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Acertos / Erros</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white"><span className="text-emerald-500 dark:text-emerald-300">{dashboard.totals.totalCorrect}</span> <span className="text-slate-400">/</span> <span className="text-red-500 dark:text-red-300">{dashboard.totals.totalWrong}</span></h2>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="space-y-8 lg:col-span-2">
          <details className="rounded-xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-primary/5">
            <summary className="cursor-pointer text-xl font-bold text-slate-900 dark:text-white">Evolução de estudos (clique para abrir)</summary>
            <div className="mt-6">
              <div className="relative flex h-56 items-end justify-between gap-2">
                {weekly.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className={`w-full rounded-t ${barColor(day.percentage)}`} style={{ height: `${Math.max(16, day.percentage)}%` }} />
                    <span className="text-[10px] text-slate-500">{day.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-primary/20 dark:bg-primary/5">
            <h3 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">Mapa de Atividade de Questões</h3>
            <div className="flex flex-col gap-2 overflow-x-auto pb-4">
              <div className="flex gap-1 min-w-max">
                {heatmap.map((day) => {
                  const ratio = day.questions / maxQuestions;
                  const cls = ratio === 0 ? "bg-slate-200 dark:bg-slate-800" : ratio < 0.3 ? "bg-primary/20" : ratio < 0.6 ? "bg-primary/40" : ratio < 0.85 ? "bg-primary/60" : "bg-primary";
                  return <div key={day.date} className={`h-4 w-4 rounded-sm ${cls}`} title={`${day.date}: ${day.questions} questões`} />;
                })}
              </div>
              <div className="mt-1 flex justify-between px-1 text-[10px] font-bold uppercase text-slate-400">
                <span>Menos atividade</span>
                <span>Mais atividade</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-primary/20 dark:bg-primary/5">
            <h3 className="mb-8 text-xl font-bold text-slate-900 dark:text-white">Performance por Matéria</h3>
            <div className="space-y-5">
              {dashboard.disciplineStats.slice(0, 8).map((item) => (
                <div key={item.discipline} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.discipline}</span>
                    <span className={`font-bold ${levelColor(item.percentage)}`}>{pct(item.percentage)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className={`h-full rounded-full ${barColor(item.percentage)}`} style={{ width: `${Math.min(100, item.percentage)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-red-300 bg-white dark:border-red-500/20 dark:bg-primary/5">
        <div className="border-b border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Atenção Urgente (&lt;60%)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-transparent">
              <tr>
                <th className="px-6 py-3">Tópico</th>
                <th className="px-6 py-3 text-center">Questões</th>
                <th className="px-6 py-3 text-right">Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {weakest.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="transition-colors hover:bg-red-500/5">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.subject}</span>
                      <span className="text-xs text-slate-500">{item.discipline}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700 dark:text-slate-300">{item.questions}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400">{pct(item.percentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
