import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus, RefreshCcw, Target, TimerReset } from "lucide-react";
import { DailyGoalsCard } from "@/components/daily-goals-card";
import { GoalSettingsForm, ReflectionForm } from "@/components/goal-forms";
import { requireUser } from "@/lib/auth";
import { getDailyGoalsData } from "@/lib/daily-goals-service";
import { requireActiveStudyGuide } from "@/lib/study-guide";

const statusStyles = {
  REST: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  MINIMUM: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  TARGET: "bg-primary/15 text-primary",
  EXCELLENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  NO_ACTIVITY: "bg-slate-100 text-slate-400 dark:bg-slate-800",
} as const;

export default async function GoalsPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const data = await getDailyGoalsData(user.id, guide.id);
  const remaining = Math.max(0, data.plan.dailyMinutes - data.today.minutes);
  const RhythmIcon = data.rhythm.direction === "increasing" ? ArrowUpRight : data.rhythm.direction === "decreasing" ? ArrowDownRight : Minus;
  const rhythmLabel = data.rhythm.direction === "increasing" ? "Ritmo aumentando" : data.rhythm.direction === "decreasing" ? "Ritmo diminuindo" : "Ritmo estável";
  const activeDays = data.settings.activeWeekdays.length;

  return <div className="space-y-7 pb-20">
    <header>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Plano pessoal · {guide.name}</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Minhas metas</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">Veja o que falta hoje e acompanhe sua semana sem cálculos complicados.</p>
    </header>

    <DailyGoalsCard data={data} />

    <section aria-label="Resumo das metas" className="grid gap-4 sm:grid-cols-3">
      <Metric label="Tempo restante hoje" value={`${remaining} min`} detail={remaining ? "para concluir a meta diária" : "meta diária concluída"} icon={TimerReset} />
      <Metric label="Questões nesta semana" value={data.plan.weeklyQuestions > 0 ? `${data.plan.questionsThisWeek} / ${data.plan.weeklyQuestions}` : String(data.plan.questionsThisWeek)} detail={data.plan.weeklyQuestions > 0 ? `${data.plan.questionsRemaining} restantes` : "sem meta definida"} icon={Target} />
      <Metric label="Revisões disponíveis" value={String(data.plan.reviewsDue)} detail={data.plan.reviewsDue ? "faça quando couber na rotina" : "nenhuma pendente"} icon={RefreshCcw} />
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
        <div className="flex items-center gap-3"><CalendarDays className="text-primary" /><div><h2 className="text-xl font-black">Esta semana</h2><p className="text-sm text-slate-500">Sua constância nos dias escolhidos para estudar.</p></div></div>
        <div className="mt-5 grid grid-cols-7 gap-2">{data.week.map((day) => <div key={day.dayKey} className="text-center"><div title={day.status} aria-label={`${day.dayKey}: ${day.status}`} className={`mx-auto grid aspect-square max-w-12 place-items-center rounded-xl text-xs font-black ${statusStyles[day.status]}`}>{day.dayKey.slice(-2)}</div><p className="mt-1 text-[10px] uppercase text-slate-400">{new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.dayKey}T12:00:00Z`)).slice(0, 3)}</p></div>)}</div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Small label="Dias com meta" value={`${data.weekTotals.targetDays}/${activeDays}`} /><Small label="Tempo estudado" value={`${data.weekTotals.minutes} min`} /><Small label="Questões" value={String(data.plan.questionsThisWeek)} /><Small label="Média por dia" value={`${data.weekTotals.averageMinutes} min`} /></div>
        <div className="mt-5 flex flex-wrap gap-3 text-xs"><Legend style={statusStyles.REST} label="Descanso" /><Legend style={statusStyles.IN_PROGRESS} label="Em andamento" /><Legend style={statusStyles.TARGET} label="Meta cumprida" /><Legend style={statusStyles.NO_ACTIVITY} label="Sem atividade" /></div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
        <div className="flex items-center gap-3"><RhythmIcon className="text-primary" /><div><h2 className="text-xl font-black">Seu ritmo</h2><p className="text-sm text-slate-500">Uma leitura simples da sua constância.</p></div></div>
        <p className="mt-5 text-2xl font-black">{rhythmLabel}</p><p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{data.rhythm.reason}</p>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500 dark:bg-slate-900/50">Comparamos seu tempo médio recente com as semanas anteriores. Essa informação é apenas uma referência e não altera o cumprimento da meta.</div>
      </article>
    </section>

    <section id="ajustar-plano" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
      <h2 className="text-xl font-black">Ajustar meu plano</h2><p className="mt-1 mb-6 text-sm text-slate-500">Escolha somente o essencial. Você pode mudar estes valores quando sua rotina mudar.</p><GoalSettingsForm data={data} />
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
      <h2 className="text-xl font-black">Fechamento do dia</h2><p className="mt-1 mb-4 text-sm text-slate-500">Opcional: registre rapidamente o que funcionou e o que deseja ajustar amanhã.</p><ReflectionForm data={data} />
    </section>
  </div>;
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Target }) { return <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{label}</p><Icon size={18} className="text-primary" /></div><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>; }
function Small({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function Legend({ style, label }: { style: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${style}`} />{label}</span>; }
