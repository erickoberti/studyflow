import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getNextCycleSuggestion } from "@/lib/analytics";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { DisciplinePie } from "@/components/charts/discipline-pie";

function metric(label: string, value: string, helper?: string) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}

function signalBadge(level: "verde" | "amarelo" | "vermelho", label: string) {
  const styles: Record<string, string> = {
    verde: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    amarelo: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    vermelho: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  };

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${styles[level]}`}>{label}</span>;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [dashboard, suggestion] = await Promise.all([
    getDashboardData(user.id),
    getNextCycleSuggestion(user.id),
  ]);

  const gapText =
    dashboard.totals.gapToTarget > 0
      ? `Faltam ${dashboard.totals.gapToTarget.toFixed(1)}% para a meta`
      : `Meta batida por ${Math.abs(dashboard.totals.gapToTarget).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1152d4] to-blue-700 p-7 text-white shadow-xl shadow-blue-900/20">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-100">
              <Sparkles size={14} /> Proxima sessao
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight lg:text-4xl">{suggestion.next?.subject.name ?? "Cadastre assuntos no ciclo"}</h1>
            <p className="mt-2 text-sm text-blue-100/90">
              {suggestion.next
                ? `${suggestion.next.subject.discipline.name} • Peso ${suggestion.next.subject.weight} • Ordem #${suggestion.next.orderIndex}`
                : "Monte seu ciclo para receber sugestoes automaticas."}
            </p>
            <p className="mt-1 text-xs text-blue-200">Ultimo estudado: {suggestion.last?.subject.name ?? "Nenhum ainda"}</p>
          </div>
          <Link
            href="/registro"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#1152d4] transition hover:bg-blue-50"
          >
            Registrar estudo agora
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metric("Total de questoes", String(dashboard.totals.totalQuestions))}
        {metric("Acertos", String(dashboard.totals.totalCorrect))}
        {metric("Erros", String(dashboard.totals.totalWrong))}
        {metric("% Dia (media geral)", `${dashboard.totals.overallPercentage.toFixed(1)}%`)}
        {metric("Meta %", `${dashboard.totals.targetPercentage.toFixed(1)}%`, gapText)}
        {metric("Hora estimada", `${(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h`, `${dashboard.totals.totalEstimatedMinutes} min acumulados`)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Status atual vs meta</h3>
          {signalBadge(dashboard.totals.metaLevel, dashboard.totals.metaLabel)}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <EvolutionChart data={dashboard.byDay} label="Evolucao diaria" />
        <EvolutionChart data={dashboard.byWeek.map((w) => ({ date: w.week, percentage: w.percentage }))} label="Evolucao semanal" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DisciplinePie data={dashboard.disciplineStats.map((item) => ({ discipline: item.discipline, questions: item.questions }))} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Meta por assunto (semaforo)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {dashboard.subjectStats.slice(0, 12).map((subject) => (
              <li key={`${subject.discipline}-${subject.subject}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <div>
                  <p className="font-semibold">{subject.subject}</p>
                  <p className="text-xs text-slate-500">
                    {subject.percentage.toFixed(1)}% vs meta {subject.targetPercentage.toFixed(1)}% • Gap {subject.gap.toFixed(1)}%
                  </p>
                </div>
                {signalBadge(subject.metaLevel, subject.metaLabel)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}