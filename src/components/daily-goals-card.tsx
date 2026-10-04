import Link from "next/link";
import { Check, Clock3, RefreshCcw, Target } from "lucide-react";
import type { DailyGoalsData } from "@/lib/daily-goals-service";

export const statusLabel = {
  REST: "Descanso planejado",
  IN_PROGRESS: "Dia em andamento",
  MINIMUM: "Você já começou",
  TARGET: "Meta de hoje cumprida",
  EXCELLENT: "Meta de hoje superada",
  NO_ACTIVITY: "Pronto para começar",
} as const;

export function DailyGoalsCard({ data, compact = false }: { data: DailyGoalsData; compact?: boolean }) {
  const minutes = data.today.minutes;
  const dailyMinutes = data.plan.dailyMinutes;
  const minutesPercentage = dailyMinutes > 0 ? Math.min(100, Math.round((minutes / dailyMinutes) * 100)) : 100;
  const weeklyQuestions = data.plan.weeklyQuestions;
  const questionsPercentage = weeklyQuestions > 0
    ? Math.min(100, Math.round((data.plan.questionsThisWeek / weeklyQuestions) * 100))
    : 0;
  const minutesRemaining = Math.max(0, dailyMinutes - minutes);

  let nextAction = "Seu plano está em dia.";
  if (data.today.plannedRest) nextAction = "Hoje é um dia de descanso no seu plano.";
  else if (minutesRemaining > 0) nextAction = `Estude mais ${minutesRemaining} min para concluir a meta de hoje.`;
  else if (data.plan.reviewsDue > 0) nextAction = `Meta diária cumprida. Você tem ${data.plan.reviewsDue} ${data.plan.reviewsDue === 1 ? "revisão pendente" : "revisões pendentes"}.`;
  else if (data.plan.questionsRemaining > 0) nextAction = `Meta diária cumprida. Uma boa referência é fazer ${data.plan.suggestedQuestionsToday} questões hoje.`;
  else nextAction = "Metas de hoje e da semana em dia. Bom trabalho!";

  if (compact) return <section aria-labelledby="today-plan-title" className="sf-surface grid grid-cols-2 items-center gap-x-4 gap-y-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5">
    <div className="col-span-2 sm:col-span-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="today-plan-title" className="sf-eyebrow">Plano de hoje</h2><span className="text-xs font-medium text-textSecondary">{minutes} / {dailyMinutes} min · {statusLabel[data.today.status]}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Tempo estudado hoje" aria-valuemin={0} aria-valuemax={100} aria-valuenow={minutesPercentage}><div className="h-full rounded-full bg-primary" style={{ width: minutesPercentage + "%" }} /></div><p className="mt-2 text-xs text-textSecondary">{data.today.plannedRest ? "Descanso planejado" : minutesRemaining ? minutesRemaining + " min restantes" : "Meta diária concluída"}</p></div>
    <div className="text-xs"><p className="sf-eyebrow">Questões na semana</p><p className="mt-1 font-semibold">{data.plan.questionsThisWeek}{weeklyQuestions > 0 ? " / " + weeklyQuestions : " realizadas"}</p>{data.plan.reviewsDue > 0 ? <p className="mt-1 text-textSecondary">{data.plan.reviewsDue} revisões disponíveis</p> : null}</div>
    <Link href="/metas#ajustar-plano" className="inline-flex min-h-12 items-center justify-end text-xs font-semibold text-primary sm:min-h-11">Ajustar plano</Link>
  </section>;

  return <section aria-labelledby="today-plan-title" className="rounded-3xl border border-primary/20 bg-gradient-to-br from-white via-white to-primary/5 p-5 shadow-sm dark:from-panelDark dark:via-panelDark dark:to-primary/10 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Seu plano</p>
        <h2 id="today-plan-title" className="mt-1 text-2xl font-semibold">Foco de hoje</h2>
        <p className="mt-1 text-sm text-textSecondary">Conclua seu tempo de estudo. As questões são acompanhadas ao longo da semana.</p>
      </div>
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-primary/15 text-lg font-semibold text-primary" aria-label={`${minutesPercentage}% da meta diária`}>{minutesPercentage}%</div>
    </div>

    <div className={`mt-5 grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
      <Progress
        icon={Clock3}
        label="Tempo hoje"
        value={`${minutes} / ${dailyMinutes} min`}
        percentage={minutesPercentage}
        complete={minutesPercentage >= 100}
      />
      <Progress
        icon={Target}
        label="Questões na semana"
        value={weeklyQuestions > 0 ? `${data.plan.questionsThisWeek} / ${weeklyQuestions}` : `${data.plan.questionsThisWeek} realizadas`}
        percentage={questionsPercentage}
        complete={weeklyQuestions > 0 && questionsPercentage >= 100}
        detail={weeklyQuestions === 0 ? "Sem meta semanal definida" : undefined}
      />
    </div>

    {data.plan.reviewsDue > 0 ? <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><RefreshCcw size={15} />{data.plan.reviewsDue} {data.plan.reviewsDue === 1 ? "revisão disponível" : "revisões disponíveis"}</div> : null}

    <div className="mt-5 flex flex-col gap-4 border-t border-slate-200/70 pt-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-primary">{statusLabel[data.today.status]}</p><p className="mt-0.5 text-sm text-textSecondary dark:text-textSecondary">{nextAction}</p></div>
      <div className="flex gap-2"><Link href="/metas#ajustar-plano" className="rounded-xl border border-primary/20 px-4 py-2.5 text-center text-sm font-semibold text-primary">Ajustar metas</Link><Link href="/registro" className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-soft">Continuar estudando</Link></div>
    </div>
  </section>;
}

function Progress({ icon: Icon, label, value, percentage, complete, detail }: { icon: typeof Clock3; label: string; value: string; percentage: number; complete: boolean; detail?: string }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-surface/70 p-4 dark:border-white/5 dark:bg-slate-950/20">
    <div className="mb-2 flex items-center justify-between gap-2 text-sm"><span className="inline-flex items-center gap-2 font-semibold text-textSecondary dark:text-textSecondary"><Icon size={16} />{label}</span>{complete ? <Check size={17} className="text-emerald-500" aria-label="Concluída" /> : <span className="font-semibold">{value}</span>}</div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-elevated" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div className={`h-full rounded-full transition-[width] duration-300 ${complete ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${percentage}%` }} /></div>
    {complete ? <p className="mt-2 text-xs font-semibold text-emerald-600">{value}</p> : detail ? <p className="mt-2 text-xs text-textSecondary">{detail}</p> : null}
  </div>;
}
