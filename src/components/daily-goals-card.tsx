import Link from "next/link";
import { Check, ChevronRight, Clock3, ListChecks, RefreshCcw, Target } from "lucide-react";
import type { DailyGoalsData } from "@/lib/daily-goals-service";
import type { DailyGoalMetric } from "@/lib/daily-goals";

const metricInfo: Record<Exclude<DailyGoalMetric, "firstStudy">, { label: string; icon: typeof Clock3; unit: string }> = {
  minutes: { label: "Tempo", icon: Clock3, unit: "min" }, questions: { label: "Questões", icon: Target, unit: "" }, sessions: { label: "Sessões", icon: ListChecks, unit: "" }, reviews: { label: "Revisões", icon: RefreshCcw, unit: "" }, cyclePosition: { label: "Posição do ciclo", icon: ChevronRight, unit: "" },
};

const statusLabel = { REST: "Descanso planejado", IN_PROGRESS: "Dia em andamento", MINIMUM: "Mínimo cumprido", TARGET: "Meta cumprida", EXCELLENT: "Dia excelente", NO_ACTIVITY: "Sem atividade" } as const;

export function DailyGoalsCard({ data, compact = false }: { data: DailyGoalsData; compact?: boolean }) {
  const metrics = data.settings.enabledMetrics.filter((metric): metric is Exclude<DailyGoalMetric, "firstStudy"> => metric !== "firstStudy" && metric in metricInfo).slice(0, compact ? 4 : 5);
  const actual: Record<Exclude<DailyGoalMetric, "firstStudy">, number> = { minutes: data.today.minutes + (data.settings.includeMockExams ? data.today.mockExamMinutes : 0), questions: data.today.questions + (data.settings.includeMockExams ? data.today.mockExamQuestions : 0), sessions: data.today.sessions, reviews: data.today.reviews, cyclePosition: data.today.cyclePosition };
  return <section aria-labelledby="today-focus-title" className="rounded-3xl border border-primary/20 bg-gradient-to-br from-white via-white to-primary/5 p-5 shadow-sm dark:from-panelDark dark:via-panelDark dark:to-primary/10 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Processo diário</p><h2 id="today-focus-title" className="mt-1 text-2xl font-black">Foco de hoje</h2><p className="mt-1 text-sm text-slate-500">O necessário para considerar seu dia vencido.</p></div><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-primary/15 text-lg font-black text-primary" aria-label={`${data.today.percentage}% da meta`}>{data.today.percentage}%</div></div>
    <div className={`mt-5 grid gap-4 ${compact ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>
      {metrics.map((metric) => { const info = metricInfo[metric]; const Icon = info.icon; const value = actual[metric]; const target = data.targets.target[metric]; const done = target > 0 && value >= target; const pct = target ? Math.min(100, value / target * 100) : 100; return <div key={metric} className="min-w-0"><div className="mb-1.5 flex items-center justify-between gap-2 text-sm"><span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300"><Icon size={15} />{info.label}</span>{done ? <Check size={16} className="text-emerald-500" aria-label="Concluída" /> : <span className="font-black">{value} / {target} {info.unit}</span>}</div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={info.label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(value, target)}><div className={`h-full rounded-full transition-[width] duration-300 ${done ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div></div>; })}
    </div>
    {data.settings.includeMockExams && data.today.mockExams > 0 ? <p className="mt-3 text-xs text-slate-500">Simulados incluídos: {data.today.mockExams} · {data.today.mockExamMinutes} min · {data.today.mockExamQuestions} questões</p> : null}
    <div className="mt-5 flex flex-col gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-primary">{statusLabel[data.today.status]}</p><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold">Próxima ação:</span> {data.today.nextAction}</p></div><div className="flex gap-2"><Link href="/metas" className="rounded-xl border border-primary/20 px-4 py-2.5 text-center text-sm font-black text-primary">Ver metas</Link><Link href="/registro" className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-black text-white shadow-soft">Continuar estudando</Link></div></div>
  </section>;
}
