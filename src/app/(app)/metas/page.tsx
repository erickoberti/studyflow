import shell from "@/components/official-shell.module.css";
import visual from "@/components/resource-screens.module.css";
import { ArrowDownRight, ArrowUpRight, CalendarDays, MessageSquareText, Minus, Settings2 } from "lucide-react";
import { statusLabel } from "@/components/daily-goals-card";
import { GoalSettingsForm, ReflectionForm } from "@/components/goal-forms";
import { requireUser } from "@/lib/auth";
import { getDailyGoalsData } from "@/lib/daily-goals-service";
import { requireActiveStudyGuide } from "@/lib/study-guide";

const statusStyles = {
  REST: "bg-slate-200 text-textSecondary dark:bg-slate-700 dark:text-textSecondary",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  MINIMUM: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  TARGET: "bg-primary/15 text-primary",
  EXCELLENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  NO_ACTIVITY: "bg-slate-100 text-textSecondary dark:bg-elevated dark:text-textSecondary",
} as const;

export default async function GoalsPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const data = await getDailyGoalsData(user.id, guide.id);
  const RhythmIcon = data.rhythm.direction === "increasing" ? ArrowUpRight : data.rhythm.direction === "decreasing" ? ArrowDownRight : Minus;
  const rhythmLabel = data.rhythm.direction === "increasing" ? "Ritmo aumentando" : data.rhythm.direction === "decreasing" ? "Ritmo diminuindo" : "Ritmo estável";
  const minutesRemaining = Math.max(0, data.plan.dailyMinutes - data.today.minutes);
  const minutesPercentage = data.plan.dailyMinutes > 0 ? Math.min(100, Math.round((data.today.minutes / data.plan.dailyMinutes) * 100)) : 100;

  return <div className={`${shell.screen} ${visual.page} ${visual.goals} space-y-5`}>
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-textSecondary dark:text-textSecondary">Plano pessoal · {guide.name}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Minhas metas</h1>
      <p className="mt-1 max-w-2xl text-sm text-textSecondary dark:text-textSecondary">Configure sua rotina e acompanhe o cumprimento do plano.</p>
    </header>

    <section aria-labelledby="current-goal-title" className="rounded-card border border-slate-200 bg-surface p-4 dark:border-white/5 dark:bg-panelDark sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-textSecondary dark:text-textSecondary">Hoje · meta diária</p><h2 id="current-goal-title" className="mt-1 text-lg font-semibold">Tempo de estudo</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-textSecondary dark:bg-elevated dark:text-slate-200">{statusLabel[data.today.status]}</span></div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1"><p className="text-2xl font-semibold">{data.plan.dailyMinutes} min <span className="text-sm font-normal text-textSecondary dark:text-textSecondary">por dia</span></p><p className="text-sm text-textSecondary dark:text-textSecondary">{data.today.minutes} min realizados · {data.today.plannedRest ? "descanso planejado" : minutesRemaining ? `${minutesRemaining} min restantes` : "meta concluída"}</p></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-elevated" role="progressbar" aria-label="Progresso da meta diária" aria-valuemin={0} aria-valuemax={100} aria-valuenow={minutesPercentage}><div className="h-full rounded-full bg-primary" style={{ width: `${minutesPercentage}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-sm dark:border-white/5"><p><span className="text-textSecondary dark:text-textSecondary">Questões nesta semana:</span> <strong>{data.plan.questionsThisWeek}{data.plan.weeklyQuestions > 0 ? ` / ${data.plan.weeklyQuestions}` : " realizadas"}</strong></p><p><span className="text-textSecondary dark:text-textSecondary">Revisões disponíveis:</span> <strong>{data.plan.reviewsDue}</strong></p></div>
    </section>

    <details id="ajustar-plano" className="group scroll-mt-24 rounded-card border border-slate-200 bg-surface dark:border-white/5 dark:bg-panelDark">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5"><span className="flex items-center gap-3"><Settings2 className="shrink-0 text-primary" /><span><span className="block text-base font-semibold">Ajustar meu plano</span><span className="mt-0.5 block text-xs font-normal text-textSecondary dark:text-textSecondary">Dias de estudo, tempo diário, questões e data da prova</span></span></span><span className="text-sm font-semibold text-primary group-open:hidden dark:text-primarySoft">Abrir</span><span className="hidden text-sm font-semibold text-primary group-open:inline dark:text-primarySoft">Fechar</span></summary>
      <div className="border-t border-slate-200 p-4 dark:border-white/5 sm:p-5"><GoalSettingsForm data={data} /></div>
    </details>

    <section aria-label="Evolução do plano" className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <article className="rounded-card border border-slate-200 bg-surface p-4 dark:border-white/5 dark:bg-panelDark sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3"><CalendarDays className="shrink-0 text-primary" /><div><h2 className="text-lg font-semibold">Esta semana</h2><p className="text-xs text-textSecondary dark:text-textSecondary">{data.weekTotals.targetDays} dias com meta · {data.weekTotals.minutes} min · {data.plan.questionsThisWeek} questões</p></div></div>
          <p className="hidden text-sm font-semibold text-textSecondary dark:text-textSecondary sm:block">média {data.weekTotals.averageMinutes} min/dia</p>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">{data.week.map((day) => <div key={day.dayKey} className="min-w-0 text-center"><div title={statusLabel[day.status]} aria-label={`${day.dayKey}: ${statusLabel[day.status]}`} className={`mx-auto grid h-8 w-8 place-items-center rounded-lg text-xs font-semibold ${statusStyles[day.status]}`}>{day.dayKey.slice(-2)}</div><p className="mt-1 truncate text-xs uppercase text-textSecondary dark:text-textSecondary">{new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.dayKey}T12:00:00Z`)).slice(0, 3)}</p></div>)}</div>
        <p className="mt-3 text-xs text-textSecondary dark:text-textSecondary sm:hidden">Média: {data.weekTotals.averageMinutes} min/dia</p>
      </article>

      <article className="rounded-card border border-slate-200 bg-surface p-4 dark:border-white/5 dark:bg-panelDark sm:p-5">
        <div className="flex items-center gap-2"><RhythmIcon size={20} className="text-primary" /><div><h2 className="text-lg font-semibold">Seu ritmo</h2><p className="text-sm font-medium">{rhythmLabel}</p></div></div>
        <p className="mt-3 text-sm leading-relaxed text-textSecondary dark:text-textSecondary">{data.rhythm.reason}</p>
      </article>
    </section>

    <details className="group rounded-3xl border border-slate-200 bg-surface dark:border-white/5 dark:bg-panelDark">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6"><span className="flex items-center gap-3"><MessageSquareText className="text-primary" /><span><span className="block font-semibold">Nota rápida do dia <span className="font-normal text-textSecondary">(opcional)</span></span><span className="mt-0.5 block text-xs font-normal text-textSecondary">Use somente quando houver algo útil para lembrar amanhã</span></span></span><span className="text-sm font-semibold text-primary group-open:hidden">Adicionar</span><span className="hidden text-sm font-semibold text-primary group-open:inline">Fechar</span></summary>
      <div className="border-t border-slate-200 p-5 dark:border-white/5 sm:p-6"><ReflectionForm data={data} /></div>
    </details>
  </div>;
}
