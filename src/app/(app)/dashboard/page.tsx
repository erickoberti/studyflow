import Link from "next/link";
import { format } from "date-fns";
import {
  Clock3,
  Flame,
  Library,
  Play,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getNextCycleSuggestion } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";

function dayKeyInSaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPtBrDay(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);

  const todayKey = dayKeyInSaoPaulo(new Date());
  const [dashboard, suggestion, recentSessions] = await Promise.all([
    getDashboardData(user.id, guide.id),
    getNextCycleSuggestion(user.id, guide.id),
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 3,
      include: {
        cycleEntry: { include: { subject: { include: { discipline: true } } } },
      },
    }),
  ]);

  const byDayMap = new Map(dashboard.byDay.map((d) => [d.date, d.questions]));
  const week = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = dayKeyInSaoPaulo(date);
    return {
      key,
      label: format(date, "EEE").replace(".", "").slice(0, 3).toUpperCase(),
      value: byDayMap.get(key) ?? 0,
    };
  });

  const highest = Math.max(1, ...week.map((d) => d.value));
  const today = byDayMap.get(todayKey) ?? 0;
  const focusScore = dashboard.totals.overallPercentage;
  const streak = dashboard.totals.streakDays;

  const nextSubject = suggestion.next?.subject.name ?? "Sem tópico definido";
  const nextDiscipline = suggestion.next?.subject.discipline.name ?? "Organize seu ciclo";
  const nextNotes = suggestion.next?.subject.notes ?? "Adicione notas no ciclo para uma sugestão mais precisa.";

  return (
    <div className="space-y-8 pb-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Painel de Estudos</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Bem-vindo de volta, {user.name?.split(" ")[0] ?? "Aluno"}. Sequência atual de {streak} dias.
          </p>
        </div>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft"
        >
          <Zap size={16} /> Iniciar Sessão
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Horas Estudadas</span>
            <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Clock3 size={16} /></span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h</p>
          <p className="mt-1 text-sm font-semibold text-emerald-500">+5%</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Disciplinas Ativas</span>
            <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Library size={16} /></span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{dashboard.disciplineStats.length}</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">Estável</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Sequência Atual</span>
            <span className="rounded-lg bg-orange-500/10 p-1.5 text-orange-500"><Flame size={16} /></span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{streak} dias</p>
          <p className="mt-1 text-sm font-semibold text-emerald-500">+2%</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Índice de Foco</span>
            <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Target size={16} /></span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{focusScore.toFixed(1)}%</p>
          <p className="mt-1 text-sm font-semibold text-emerald-500">+12%</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Progresso da Meta Diária</h3>
                <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  Meta: {dashboard.totals.dailyQuestionsGoal} questões
                </span>
            </div>

            <div className="space-y-4">
              {dashboard.disciplineStats.slice(0, 3).map((item) => {
                const pct = Math.max(0, Math.min(100, item.percentage));
                return (
                  <div key={item.discipline} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{item.discipline}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Atividade de Estudo \(Semana\)</h4>
                <span className="text-xs font-bold text-slate-500">Hoje: {today} questões</span>
              </div>
              <div className="flex h-36 items-end justify-between gap-2 px-1">
                {week.map((day) => (
                  <div key={day.key} className="group relative flex-1 rounded-t bg-primary/20" style={{ height: `${Math.max(12, (day.value / highest) * 100)}%` }}>
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                      {day.value}q
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between px-1 text-[10px] font-bold text-slate-400">
                {week.map((day) => (
                  <span key={day.key}>{day.label}</span>
                ))}
              </div>
            </div>
          </article>

          <article>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Disciplinas Ativas</h3>
              <Link href="/base" className="text-sm font-bold text-primary hover:underline">Ver todos</Link>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.subjectStats.slice(0, 3).map((item) => (
                <div key={`${item.discipline}-${item.subject}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-primary/40 dark:border-slate-800 dark:bg-panelDark">
                  <div className="h-24 bg-gradient-to-br from-primary/20 to-transparent" />
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">{item.discipline}</p>
                    <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.subject}</h4>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                      <span className="text-slate-500">{item.questions} questões</span>
                      <span className="rounded bg-slate-100 px-2 py-1 font-bold dark:bg-slate-800">{item.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="space-y-6">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Próximas Tarefas</h3>
              <Link href="/registros" className="text-xs font-bold text-primary hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div key={session.id} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex min-w-[52px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-1 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{format(session.date, "MMM")}</span>
                    <span className="text-lg font-black text-primary">{format(session.date, "dd")}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{session.cycleEntry.subject.name}</p>
                    <p className="text-xs text-slate-500">{formatPtBrDay(session.date)} • {session.questions} questões</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Dica de IA</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Foque em {nextDiscipline} e revise o tópico {nextSubject.toLowerCase()}.</p>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary to-primarySoft p-5 text-white shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-90">Próximo Tópico</p>
            <h4 className="mt-2 text-xl font-black">{nextSubject}</h4>
            <p className="mt-2 text-sm text-white/85">{nextNotes}</p>
            <Link href="/registro" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-primary">
              <Play size={14} /> Iniciar agora
            </Link>
          </article>
        </aside>
      </section>
    </div>
  );
}



