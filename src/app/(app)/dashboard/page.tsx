import Link from "next/link";
import { format } from "date-fns";
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Clock3,
  FileText,
  Flame,
  PlaySquare,
  TrendingUp,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getNextCycleSuggestion } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

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

function taskVisual(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("simulado") || s.includes("quest")) {
    return { icon: ClipboardCheck, bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" };
  }
  if (s.includes("aula") || s.includes("video")) {
    return { icon: PlaySquare, bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" };
  }
  return { icon: FileText, bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" };
}

export default async function DashboardPage() {
  const user = await requireUser();

  const todayKey = dayKeyInSaoPaulo(new Date());

  const [dashboard, suggestion, recentSessions] = await Promise.all([
    getDashboardData(user.id),
    getNextCycleSuggestion(user.id),
    prisma.studySession.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: {
        cycleEntry: { include: { subject: { include: { discipline: true } } } },
      },
    }),
  ]);

  const byDayMap = new Map(dashboard.byDay.map((d) => [d.date, d.questions]));
  const last7Dates = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = dayKeyInSaoPaulo(date);
    return {
      key,
      label: format(date, "EEE").replace(".", "").slice(0, 3).toUpperCase(),
      questions: byDayMap.get(key) ?? 0,
    };
  });

  const longestBar = Math.max(1, ...last7Dates.map((d) => d.questions));
  const totalLast7 = last7Dates.reduce((sum, day) => sum + day.questions, 0);

  const todayQuestions = byDayMap.get(todayKey) ?? 0;
  const totalQuestions = dashboard.totals.totalQuestions;
  const totalCorrect = dashboard.totals.totalCorrect;
  const overallPercentage = dashboard.totals.overallPercentage;
  const nextTopic = suggestion.next?.subject.name ?? "Cadastre um assunto no ciclo";
  const nextDiscipline = suggestion.next?.subject.discipline.name ?? "Sem disciplina";
  const topicDesc = suggestion.next?.subject.notes ?? "Revisão programada para hoje. Continue seu ciclo.";
  const estimatedMinutes = Math.max(25, Math.round((suggestion.next?.subject.weight ?? 1) * 25));

  return (
    <div className="space-y-6 pb-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Bom dia, {user.name?.split(" ")[0] ?? "Aluno"}! 👋</h1>
          <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
            Você já completou <span className="font-bold text-primary">{dashboard.totals.targetPercentage.toFixed(0)}%</span> da sua meta diária. Continue assim!
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hoje: {todayQuestions} questões • Passagens completas no ciclo: {dashboard.totals.cyclePasses}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-[#1a1c2e] dark:text-slate-200">
            <Bell size={16} /> Novo Objetivo
          </button>
          <Link href="/registro" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20">
            <Zap size={16} /> Estudo Focado
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="group relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/20 to-[#1a1c2e] p-6">
            <div className="absolute right-0 top-0 p-8 opacity-10 transition-transform duration-500 group-hover:scale-110">
              <BookOpen className="h-24 w-24" />
            </div>
            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex-1">
                <span className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Próximo Tópico</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{nextDiscipline}: {nextTopic}</h3>
                <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-300">{topicDesc}</p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link href="/registro" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-primary shadow-xl">
                    Iniciar Agora
                  </Link>
                  <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                    <Clock3 size={16} className="text-primary" />
                    Começa em {estimatedMinutes} min
                  </div>
                </div>
              </div>
              <div className="w-full rounded-lg border border-white/10 bg-[#0f111a]/50 p-2 md:w-48 md:aspect-square">
                <div className="flex h-full w-full items-center justify-center rounded bg-black/20 text-5xl text-primary">∿</div>
              </div>
            </div>
          </article>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#1a1c2e]">
              <div className="mb-5 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white">Tempo de Estudo</h4>
                <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">Semanal</span>
              </div>
              <div className="mb-4 flex h-32 items-end gap-2">
                {last7Dates.map((day) => (
                  <div key={day.key} className="flex-1 rounded-t-sm bg-primary/20" style={{ height: `${Math.max(22, (day.questions / longestBar) * 100)}%` }} />
                ))}
              </div>
              <div className="flex justify-between px-1 text-[10px] font-medium text-slate-500">
                {last7Dates.map((day) => (
                  <span key={day.key}>{day.label}</span>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#1a1c2e]">
              <div className="mb-5 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white">Precisão em Testes</h4>
                <TrendingUp size={18} className="text-primary" />
              </div>
              <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="351.85"
                    strokeDashoffset={351.85 - (Math.min(100, overallPercentage) / 100) * 351.85}
                    className="text-primary"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{overallPercentage.toFixed(0)}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">+2% este mês</span>
                </div>
              </div>
              <div className="mt-6 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Total de questões</span><span className="font-bold">{totalQuestions}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Respostas corretas</span><span className="font-bold text-emerald-500">{totalCorrect}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Últimos 7 dias</span><span className="font-bold">{totalLast7}</span></div>
              </div>
            </article>
          </section>
        </div>

        <div className="space-y-6">
          <article className="relative overflow-hidden rounded-xl bg-primary p-6 text-white shadow-xl shadow-primary/30">
            <div className="relative z-10">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest opacity-80">Ofensiva Atual</p>
              <div className="mb-3 flex items-center gap-2">
                <Flame className="h-7 w-7" />
                <span className="text-4xl font-black">{dashboard.totals.streakDays} Dias</span>
              </div>
              <p className="text-sm opacity-90">Você está a 3 dias de bater seu recorde pessoal!</p>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#1a1c2e]">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white">Próximas Tarefas</h4>
              <Link href="/registro" className="text-xs font-bold text-primary hover:underline">Ver todas</Link>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentSessions.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Sem tarefas por enquanto.</p>
              ) : (
                recentSessions.map((session) => {
                  const pct = session.questions > 0 ? (session.correct / session.questions) * 100 : 0;
                  const visual = taskVisual(session.cycleEntry.subject.name);
                  const Icon = visual.icon;
                  return (
                    <div key={session.id} className="group flex gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-primary/5">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${visual.bg} ${visual.text}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">{session.cycleEntry.subject.name}</p>
                        <p className="text-xs text-slate-500">{formatPtBrDay(session.date)} • {session.questions} questões • {pct.toFixed(1)}%</p>
                      </div>
                      <span className={`mt-2 h-2 w-2 rounded-full ${visual.dot}`} />
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#1a1c2e]">
            <h4 className="mb-4 font-bold text-slate-900 dark:text-white">Recomendação IA</h4>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#0f111a]/50">
              <p className="mb-2 text-xs italic text-slate-500">&quot;Parece que você teve dificuldades ontem. Que tal revisar estes cards?&quot;</p>
              <button className="mt-2 w-full rounded-lg border border-primary/20 bg-primary/10 py-2 text-xs font-bold text-primary hover:bg-primary/20">
                Revisar 15 Flashcards
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
