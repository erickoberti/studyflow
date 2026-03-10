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

  const weakest = [...dashboard.subjectStats].sort((a, b) => a.percentage - b.percentage).slice(0, 10);

  return (
    <div className="space-y-6 pb-12 lg:pb-0">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Análise de Performance</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Dados consolidados do seu progresso acadêmico nos últimos 30 dias.</p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-primary/10">
          <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total de horas</p>
          <h2 className="mt-2 text-4xl font-black leading-none text-slate-900 dark:text-white">{(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-primary/10">
          <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Precisão média</p>
          <h2 className={`mt-2 text-4xl font-black leading-none ${levelColor(dashboard.totals.overallPercentage)}`}>{pct(dashboard.totals.overallPercentage)}</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-primary/10">
          <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Questões</p>
          <h2 className="mt-2 text-4xl font-black leading-none text-slate-900 dark:text-white">{dashboard.totals.totalQuestions}</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-primary/10">
          <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acertos / Erros</p>
          <h2 className="mt-2 whitespace-nowrap text-4xl font-black leading-none text-slate-900 dark:text-white">
            <span className="text-emerald-500 dark:text-emerald-300">{dashboard.totals.totalCorrect}</span>
            <span className="px-1 text-slate-400">/</span>
            <span className="text-red-500 dark:text-red-300">{dashboard.totals.totalWrong}</span>
          </h2>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-red-300 bg-white dark:border-red-500/20 dark:bg-primary/5">
          <div className="border-b border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Atenção Urgente (&lt;60%)</h3>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-[#161126]">
                <tr>
                  <th className="px-4 py-2.5">Tópico</th>
                  <th className="px-4 py-2.5 text-center">Questões</th>
                  <th className="px-4 py-2.5 text-right">Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {weakest.map((item) => (
                  <tr key={`${item.discipline}-${item.subject}`} className="transition-colors hover:bg-red-500/5">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.subject}</span>
                        <span className="text-[11px] text-slate-500">{item.discipline}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">{item.questions}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="whitespace-nowrap rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400">{pct(item.percentage)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-primary/5">
          <h3 className="mb-6 text-lg font-bold text-slate-900 dark:text-white">Performance por Matéria</h3>
          <div className="space-y-4">
            {dashboard.disciplineStats.slice(0, 10).map((item) => (
              <div key={item.discipline} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">{item.discipline}</span>
                  <span className={`whitespace-nowrap font-bold ${levelColor(item.percentage)}`}>{pct(item.percentage)}</span>
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
  );
}
