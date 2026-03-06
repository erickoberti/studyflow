import Link from "next/link";
import { Clock3, Flame, Percent, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getNextCycleSuggestion } from "@/lib/analytics";
import { EvolutionChart } from "@/components/charts/evolution-chart";
import { DisciplinePie } from "@/components/charts/discipline-pie";

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between">
        <div className="rounded-xl bg-primary/20 p-2 text-primarySoft">
          <Target size={16} />
        </div>
        <span className="text-xs font-bold text-emerald-400">{delta}</span>
      </div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-4xl font-black text-white">{value}</p>
    </article>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [dashboard, suggestion] = await Promise.all([
    getDashboardData(user.id),
    getNextCycleSuggestion(user.id),
  ]);

  const todayQuestions = dashboard.byDay.at(-1)?.questions ?? 0;
  const estimatedMinutes = dashboard.totals.totalEstimatedMinutes;

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Bom dia, {user.name?.split(" ")[0] ?? "Aluno"}!</h1>
          <p className="mt-2 text-lg text-slate-300">
            Sua meta de hoje e de <span className="font-bold text-primarySoft">{dashboard.totals.targetPercentage.toFixed(0)}%</span>. Voce fez {todayQuestions} questoes.
          </p>
        </div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-bold text-primarySoft hover:bg-primary/20"
        >
          Ver Metas
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Questoes" value={String(dashboard.totals.totalQuestions)} delta="+12%" />
        <StatCard label="Acertos" value={String(dashboard.totals.totalCorrect)} delta="+5%" />
        <StatCard label="Media Geral" value={`${dashboard.totals.overallPercentage.toFixed(1)}%`} delta="+2.1%" />
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5 shadow-soft">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-orange-500/20 p-2 text-orange-300">
              <Flame size={16} />
            </div>
            <span className="text-xs font-bold text-orange-300">{Math.max(1, dashboard.byDay.length)} dias</span>
          </div>
          <p className="text-sm text-slate-400">Ofensiva Atual</p>
          <p className="mt-1 text-4xl font-black text-white">{Math.max(1, dashboard.byDay.length)} dias</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-[#6d38e0] p-8 text-white shadow-soft">
            <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex rounded-full bg-white/20 px-4 py-1 text-xs font-black uppercase tracking-[0.14em]">
                  Proxima sessao do ciclo
                </span>
                <h2 className="text-4xl font-black leading-tight">
                  {suggestion.next?.subject.discipline.name ?? "Sem disciplina"} - {suggestion.next?.subject.name ?? "Cadastre assuntos"}
                </h2>
                <p className="flex items-center gap-2 text-white/90">
                  <Clock3 size={16} /> Tempo estimado: {Math.max(25, Math.round((suggestion.next?.subject.weight ?? 1) * 25))}min
                </p>
                <div className="flex gap-3">
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                    <p className="text-[10px] uppercase text-white/70">Pendentes</p>
                    <p className="text-2xl font-bold">{Math.max(0, dashboard.subjectStats.length)} temas</p>
                  </div>
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                    <p className="text-[10px] uppercase text-white/70">Prioridade</p>
                    <p className="text-2xl font-bold">{dashboard.totals.metaLabel}</p>
                  </div>
                </div>
              </div>
              <Link
                href="/registro"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-5 text-2xl font-black text-primary hover:bg-slate-100"
              >
                Iniciar agora
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <EvolutionChart data={dashboard.byDay} label="Evolucao semanal" />
            <DisciplinePie
              data={dashboard.disciplineStats.map((item) => ({
                discipline: item.discipline,
                questions: item.questions,
              }))}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Ofensiva</h3>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-300">
                <Flame size={14} /> {Math.max(1, dashboard.byDay.length)} dias
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => (
                <span key={d} className="text-slate-500">
                  {d}
                </span>
              ))}
              {Array.from({ length: 14 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`rounded-lg border py-2 ${idx < Math.max(1, dashboard.byDay.length) ? "border-primary/40 bg-primary/20 text-primarySoft" : "border-primary/10 text-slate-500"}`}
                >
                  {10 + idx}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-[#161126]">
            <div className="flex items-center justify-between border-b border-primary/15 p-5">
              <h3 className="text-2xl font-bold text-white">Atividades recentes</h3>
              <Link href="/estatisticas" className="text-xs font-bold text-primarySoft">
                Ver tudo
              </Link>
            </div>
            <div className="space-y-4 p-5 text-sm text-slate-300">
              <p>Total de erros: <span className="font-bold text-red-300">{dashboard.totals.totalWrong}</span></p>
              <p>Meta atual: <span className="font-bold text-primarySoft">{dashboard.totals.targetPercentage.toFixed(1)}%</span></p>
              <p>Gap da meta: <span className="font-bold text-amber-300">{dashboard.totals.gapToTarget.toFixed(1)}%</span></p>
              <p>
                Tempo acumulado: <span className="font-bold text-emerald-300">{(estimatedMinutes / 60).toFixed(1)}h</span>
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Ultimo assunto</p>
                <p className="mt-1 font-semibold text-white">{suggestion.last?.subject.name ?? "Nenhum"}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Proximo assunto</p>
                <p className="mt-1 font-semibold text-white">{suggestion.next?.subject.name ?? "Nenhum"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Percent size={16} className="text-primarySoft" />
          Meta por assunto (semaforo)
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {dashboard.subjectStats.slice(0, 10).map((subject) => (
            <div key={`${subject.discipline}-${subject.subject}`} className="rounded-xl border border-primary/15 bg-[#120e20] px-3 py-2">
              <p className="font-semibold text-white">{subject.subject}</p>
              <p className="text-xs text-slate-400">
                {subject.discipline} | {subject.percentage.toFixed(1)}% | Meta {subject.targetPercentage.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}



