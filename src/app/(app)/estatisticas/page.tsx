import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function EstatisticasPage() {
  const user = await requireUser();
  const dashboard = await getDashboardData(user.id);

  const strongest = [...dashboard.subjectStats].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
  const weakest = [...dashboard.subjectStats].sort((a, b) => a.percentage - b.percentage).slice(0, 5);

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <header>
        <h1 className="text-4xl font-black text-white">Estatisticas e Desempenho</h1>
        <p className="mt-1 text-slate-400">Acompanhe sua evolucao e identifique pontos de melhoria.</p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-[#161126] p-4">
        <div className="flex gap-2">
          {['Dia', 'Semana', 'Mes', 'Ano'].map((item, idx) => (
            <button
              key={item}
              className={`rounded-lg px-4 py-2 text-xs font-bold ${idx === 0 ? "bg-primary text-white" : "bg-primary/10 text-primarySoft"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <button className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primarySoft">Filtros avancados</button>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-8">
          <h3 className="mb-4 text-lg font-bold text-white">Frequencia de estudos (ultimos 3 meses)</h3>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 84 }).map((_, idx) => {
              const levels = ["bg-primary/10", "bg-primary/20", "bg-primary/40", "bg-primary/70"];
              return <div key={idx} className={`h-4 rounded-sm ${levels[idx % levels.length]}`} />;
            })}
          </div>
        </article>

        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-4">
          <h3 className="mb-4 text-lg font-bold text-white">Distribuicao por assunto</h3>
          <p className="text-3xl font-black text-white">{dashboard.subjectStats.length}</p>
          <p className="text-sm text-slate-400">Assuntos acompanhados</p>
          <div className="mt-4 space-y-2 text-xs text-slate-300">
            {dashboard.disciplineStats.slice(0, 4).map((d) => (
              <div key={d.discipline} className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                <span>{d.discipline}</span>
                <span>{pct(d.percentage)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-6">
          <h3 className="mb-4 text-lg font-bold text-white">Desempenho por disciplina (%)</h3>
          <div className="space-y-4">
            {dashboard.disciplineStats.map((item) => (
              <div key={item.discipline} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>{item.discipline}</span>
                  <span>{pct(item.percentage)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-primary/10">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-primary/20 bg-[#161126] p-6 lg:col-span-6">
          <h3 className="mb-4 text-lg font-bold text-white">Questoes x % acertos (tendencia)</h3>
          <div className="flex h-48 items-end gap-2">
            {dashboard.byDay.slice(-7).map((day) => (
              <div key={day.date} className="flex-1">
                <div className="w-full rounded-t bg-primary/50" style={{ height: `${Math.max(12, day.percentage)}%` }} />
                <p className="mt-2 text-center text-[10px] text-slate-500">{day.date.slice(5)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <article className="overflow-hidden rounded-xl border border-primary/20 bg-[#161126]">
          <div className="border-b border-primary/20 bg-primary/5 p-5">
            <h3 className="text-lg font-bold text-white">Assuntos em destaque</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Topico</th>
                <th className="px-6 py-3">Questoes</th>
                <th className="px-6 py-3 text-right">Media</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {strongest.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="hover:bg-primary/5">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{item.subject}</p>
                    <p className="text-xs text-slate-500">{item.discipline}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{item.questions}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300">{pct(item.percentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="overflow-hidden rounded-xl border border-red-500/30 bg-[#161126]">
          <div className="border-b border-red-500/20 bg-red-500/5 p-5">
            <h3 className="text-lg font-bold text-white">Atencao urgente ({'<'}60%)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Topico</th>
                <th className="px-6 py-3">Questoes</th>
                <th className="px-6 py-3 text-right">Media</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {weakest.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="hover:bg-red-500/5">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{item.subject}</p>
                    <p className="text-xs text-slate-500">{item.discipline}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{item.questions}</td>
                  <td className="px-6 py-4 text-right">
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
