import Link from "next/link";
import { Clock3, Flame, ListChecks, Percent, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getNextCycleSuggestion } from "@/lib/analytics";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { DisciplinePie } from "@/components/charts/discipline-pie";
import { prisma } from "@/lib/prisma";

function StatCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#161126] dark:shadow-soft">
      <div className="mb-4 flex items-start justify-between">
        <div className="rounded-xl bg-primary/20 p-2 text-primary">{icon}</div>
        <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">{delta}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-4xl font-black text-slate-900 dark:text-white">{value}</p>
    </article>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
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

  const todayQuestions = dashboard.byDay.at(-1)?.questions ?? 0;
  const estimatedMinutes = dashboard.totals.totalEstimatedMinutes;

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-[#6d38e0] p-6 text-white shadow-soft">
        <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
              Próxima sessão do ciclo
            </span>
            <h1 className="text-4xl font-black leading-tight">
              {suggestion.next?.subject.discipline.name ?? "Sem disciplina"} - {suggestion.next?.subject.name ?? "Cadastre assuntos"}
            </h1>
            <p className="flex items-center gap-2 text-white/90">
              <Clock3 size={16} /> Tempo estimado: {Math.max(25, Math.round((suggestion.next?.subject.weight ?? 1) * 25))}min
            </p>
          </div>
          <Link
            href="/registro"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 text-2xl font-black text-primary hover:bg-slate-100"
          >
            Iniciar agora
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Bom dia, {user.name?.split(" ")[0] ?? "Aluno"}!</h2>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
            Sua meta de hoje é de <span className="font-bold text-primary">{dashboard.totals.targetPercentage.toFixed(0)}%</span>. Você fez {todayQuestions} questões.
          </p>
        </div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-bold text-primary hover:bg-primary/20"
        >
          Ver metas
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de questões" value={String(dashboard.totals.totalQuestions)} delta="+12%" icon={<Target size={16} />} />
        <StatCard label="Acertos" value={String(dashboard.totals.totalCorrect)} delta="+5%" icon={<Percent size={16} />} />
        <StatCard label="Média geral" value={`${dashboard.totals.overallPercentage.toFixed(1)}%`} delta="+2.1%" icon={<ListChecks size={16} />} />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#161126] dark:shadow-soft">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-orange-500/20 p-2 text-orange-400">
              <Flame size={16} />
            </div>
            <span className="text-xs font-bold text-orange-500 dark:text-orange-300">{Math.max(1, dashboard.byDay.length)} dias</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ofensiva atual</p>
          <p className="mt-1 text-4xl font-black text-slate-900 dark:text-white">{Math.max(1, dashboard.byDay.length)} dias</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <EvolutionChart data={dashboard.byDay} label="Evolução semanal" />
          <DisciplinePie
            data={dashboard.disciplineStats.map((item) => ({
              discipline: item.discipline,
              questions: item.questions,
            }))}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Ofensiva</h3>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-500 dark:text-orange-300">
                <Flame size={14} /> {Math.max(1, dashboard.byDay.length)} dias
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d) => (
                <span key={d} className="text-slate-500">
                  {d}
                </span>
              ))}
              {Array.from({ length: 14 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`rounded-lg border py-2 ${idx < Math.max(1, dashboard.byDay.length) ? "border-primary/40 bg-primary/20 text-primary" : "border-slate-200 text-slate-500 dark:border-primary/10"}`}
                >
                  {10 + idx}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white dark:border-primary/20 dark:bg-[#161126]">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-primary/15">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Atividades recentes</h3>
              <Link href="/estatisticas" className="text-xs font-bold text-primary">
                Ver tudo
              </Link>
            </div>
            <div className="space-y-3 p-5 text-sm">
              {recentSessions.length === 0 ? (
                <p className="text-slate-500">Sem atividades ainda.</p>
              ) : (
                recentSessions.map((session) => {
                  const percentage = session.questions > 0 ? (session.correct / session.questions) * 100 : 0;
                  return (
                    <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-primary/20 dark:bg-primary/10">
                      <p className="font-semibold text-slate-900 dark:text-white">{session.cycleEntry.subject.discipline.name} - {session.cycleEntry.subject.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {session.questions} questões • {session.correct} acertos • {session.wrong} erros • {percentage.toFixed(1)}%
                      </p>
                    </div>
                  );
                })
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-primary/20 dark:bg-primary/10 dark:text-slate-400">
                Tempo acumulado: <span className="font-bold text-emerald-600 dark:text-emerald-300">{(estimatedMinutes / 60).toFixed(1)}h</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
