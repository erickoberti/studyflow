import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function levelColor(value: number) {
  if (value >= 80) return "text-emerald-300";
  if (value >= 70) return "text-amber-300";
  return "text-red-300";
}

function barColor(value: number) {
  if (value >= 80) return "bg-emerald-400";
  if (value >= 70) return "bg-amber-400";
  return "bg-red-400";
}

export default async function EstatisticasPage() {
  const user = await requireUser();
  const dashboard = await getDashboardData(user.id);

  const strongest = [...dashboard.subjectStats].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
  const weakest = [...dashboard.subjectStats].sort((a, b) => a.percentage - b.percentage).slice(0, 5);

  const maxQuestions = Math.max(1, ...dashboard.byDay.map((item) => item.questions));
  const heatmap = dashboard.byDay.slice(-84);

  const weekly = dashboard.byDay.slice(-7);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <header>
        <h1 className="text-4xl font-black text-white">Analise de performance</h1>
        <p className="mt-1 text-slate-400">Dados consolidados dos seus estudos e acertos.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total de questoes</p>
          <p className="mt-1 text-4xl font-black text-white">{dashboard.totals.totalQuestions}</p>
        </article>
        <article className="rounded-xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Acertos / Erros</p>
          <p className="mt-1 text-2xl font-black text-white">
            <span className="text-emerald-300">{dashboard.totals.totalCorrect}</span>
            <span className="text-slate-500"> / </span>
            <span className="text-red-300">{dashboard.totals.totalWrong}</span>
          </p>
        </article>
        <article className="rounded-xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Precisao media</p>
          <p className={`mt-1 text-4xl font-black ${levelColor(dashboard.totals.overallPercentage)}`}>{pct(dashboard.totals.overallPercentage)}</p>
        </article>
        <article className="rounded-xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Tempo total</p>
          <p className="mt-1 text-4xl font-black text-white">
            {Math.floor(dashboard.totals.totalEstimatedMinutes / 60)}h
            <span className="ml-1 text-2xl">{String(dashboard.totals.totalEstimatedMinutes % 60).padStart(2, "0")}m</span>
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-8">
          <h3 className="mb-5 text-xl font-bold text-white">Frequencia de estudos (ultimos 3 meses)</h3>
          <div className="grid grid-cols-12 gap-1">
            {heatmap.map((day) => {
              const ratio = day.questions / maxQuestions;
              const cls = ratio === 0 ? "bg-slate-800" : ratio < 0.3 ? "bg-primary/20" : ratio < 0.6 ? "bg-primary/45" : ratio < 0.85 ? "bg-primary/70" : "bg-primary";
              return <div key={day.date} title={`${day.date} - ${day.questions} questoes`} className={`h-4 rounded-sm ${cls}`} />;
            })}
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Menos atividade</span>
            <span>Mais atividade</span>
          </div>
        </article>

        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-4">
          <h3 className="text-xl font-bold text-white">Desempenho por disciplina</h3>
          <div className="mt-5 space-y-4">
            {dashboard.disciplineStats.slice(0, 6).map((item) => (
              <div key={item.discipline} className="space-y-1.5">
                <div className="flex justify-between text-sm text-slate-200">
                  <span>{item.discipline}</span>
                  <span className={levelColor(item.percentage)}>{pct(item.percentage)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div className={`h-2 rounded-full ${barColor(item.percentage)}`} style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-6">
          <h3 className="mb-4 text-xl font-bold text-white">Evolucao da semana</h3>
          <div className="flex h-56 items-end gap-2">
            {weekly.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                <div className={`w-full rounded-t ${barColor(day.percentage)}`} style={{ height: `${Math.max(14, day.percentage)}%` }} />
                <span className="text-[10px] text-slate-500">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-6">
          <h3 className="mb-4 text-xl font-bold text-white">Resumo por meta</h3>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Meta percentual</span>
              <span className="font-bold text-primarySoft">{dashboard.totals.targetPercentage}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Media atual</span>
              <span className={`font-bold ${levelColor(dashboard.totals.overallPercentage)}`}>{pct(dashboard.totals.overallPercentage)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Gap para meta</span>
              <span className={`font-bold ${dashboard.totals.gapToTarget <= 0 ? "text-emerald-300" : dashboard.totals.gapToTarget <= 10 ? "text-amber-300" : "text-red-300"}`}>
                {dashboard.totals.gapToTarget.toFixed(1)}%
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="overflow-hidden rounded-xl border border-primary/20 bg-[#161126]">
          <div className="border-b border-primary/20 bg-primary/10 p-4">
            <h3 className="text-base font-bold text-white">Assuntos em destaque</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Topico</th>
                <th className="px-5 py-3">Questoes</th>
                <th className="px-5 py-3 text-right">Media</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {strongest.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="hover:bg-primary/5">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-white">{item.subject}</p>
                    <p className="text-xs text-slate-500">{item.discipline}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{item.questions}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300">{pct(item.percentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="overflow-hidden rounded-xl border border-red-500/30 bg-[#161126]">
          <div className="border-b border-red-500/20 bg-red-500/10 p-4">
            <h3 className="text-base font-bold text-white">Atencao urgente (&lt;60%)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Topico</th>
                <th className="px-5 py-3">Questoes</th>
                <th className="px-5 py-3 text-right">Media</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {weakest.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="hover:bg-red-500/5">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-white">{item.subject}</p>
                    <p className="text-xs text-slate-500">{item.discipline}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{item.questions}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="rounded bg-red-500/20 px-2 py-1 text-xs font-bold text-red-300">{pct(item.percentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  );
}
