import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleAlert, Gauge, Settings, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getCycleDebug } from "@/lib/cycle-debug";

const simulationOptions = [20, 100, 200, 500];
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export default async function CycleDebugPage({ searchParams }: { searchParams?: { simular?: string } }) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const requestedTotal = Number(searchParams?.simular ?? 200);
  const total = simulationOptions.includes(requestedTotal) ? requestedTotal : 200;
  const debug = await getCycleDebug(user.id, guide.id, total);
  const projection = debug.questionProjection;
  const max = Math.max(1, ...debug.distribution.map((item) => item.count));

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/ciclo" className="inline-flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={16} /> Voltar ao ciclo</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-primary">Somente leitura</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Verificar ciclo</h1>
          <p className="mt-1 text-sm text-slate-500">Confira se todas as matérias aparecem e projete seu volume de questões até a prova.</p>
        </div>
        <span className="rounded-xl bg-primary/10 px-4 py-2 text-sm font-black text-primary">{guide.name}</span>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-xl font-black">Validação da sequência</h2><p className="mt-1 text-sm text-slate-500">A simulação é virtual e não altera sua posição nem seu histórico.</p></div>
          <div className="flex flex-wrap gap-2">
            {simulationOptions.map((amount) => <Link key={amount} href={`/debug/ciclo?simular=${amount}`} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${total === amount ? "bg-primary text-white" : "border border-primary/30 text-primary"}`}>{amount} sessões</Link>)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className={`rounded-2xl p-5 ${debug.validator?.pass ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"}`}>
            {debug.validator?.pass ? <CheckCircle2 size={24} /> : <CircleAlert size={24} />}
            <p className="mt-3 text-xs font-black uppercase tracking-wider">Resultado</p><p className="mt-1 text-2xl font-black">{debug.validator?.pass ? "Ciclo válido" : "Requer atenção"}</p><p className="mt-1 text-sm">{debug.validator?.messages[0]}</p>
          </article>
          <article className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900">
            <Target className="text-primary" size={24} /><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Cobertura</p><p className="mt-1 text-2xl font-black">{debug.distribution.filter((item) => item.count > 0).length}/{debug.distribution.length} assuntos</p><p className="mt-1 text-sm text-slate-500">{debug.allAppeared ? "Todos apareceram na sequência." : "Há assuntos que não apareceram."}</p>
          </article>
          <article className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900">
            <Gauge className="text-primary" size={24} /><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Maior intervalo</p><p className="mt-1 text-2xl font-black">{debug.validator?.maxGap ?? 0} sessões</p><p className="mt-1 text-sm text-slate-500">Maior distância entre duas aparições do mesmo assunto.</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl bg-gradient-to-br from-primary to-primarySoft p-6 text-white shadow-soft sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Projeção até a prova</p><h2 className="mt-1 text-2xl font-black">Quanto ainda cabe no seu plano</h2><p className="mt-2 max-w-2xl text-sm text-white/80">O cálculo usa a meta diária configurada e soma o resultado às questões que você já registrou neste guia.</p></div>
          <CalendarClock size={30} className="shrink-0 text-white/80" />
        </div>
        {projection.examDate ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ProjectionMetric label="Dias restantes" value={number.format(projection.daysRemaining ?? 0)} />
              <ProjectionMetric label="Já realizadas" value={number.format(projection.completedQuestions)} />
              <ProjectionMetric label="Meta por dia" value={number.format(projection.dailyQuestionsGoal)} />
              <ProjectionMetric label="Questões adicionais" value={number.format(projection.additionalQuestions ?? 0)} emphasized />
              <ProjectionMetric label="Total projetado" value={number.format(projection.projectedTotal ?? 0)} emphasized />
            </div>
            <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-white/85">
              <strong className="text-white">Conta:</strong> {projection.daysRemaining} dias × {projection.dailyQuestionsGoal} questões/dia = {number.format(projection.additionalQuestions ?? 0)} novas questões. Com as {number.format(projection.completedQuestions)} já feitas, a projeção chega a {number.format(projection.projectedTotal ?? 0)}.
              {projection.completedQuestions > 0 ? <span className="mt-2 block">Seu ritmo registrado é de {number.format(projection.currentDailyAverage)} questões/dia; mantido esse ritmo, seriam cerca de {number.format(projection.projectedAtCurrentPace ?? 0)} no total até a prova.</span> : null}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-white/10 p-5"><h3 className="font-black">Defina a data da prova para ativar a projeção</h3><p className="mt-1 text-sm text-white/80">A meta diária já está em {projection.dailyQuestionsGoal} questões. Falta apenas informar quando será a prova.</p><Link href="/configuracoes" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-primary"><Settings size={16} /> Abrir configurações</Link></div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
          <h2 className="text-lg font-black">Frequência por assunto</h2>
          <div className="mt-4 max-h-[32rem] space-y-4 overflow-auto pr-1">
            {debug.distribution.map((item) => <div key={`${item.discipline}-${item.subject}`}><div className="flex items-end justify-between gap-4 text-sm"><span><b className="block">{item.subject}</b><span className="text-xs text-slate-500">{item.discipline}</span></span><b>{item.count}×</b></div><div className="mt-1.5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${item.count ? "bg-primary" : "bg-rose-400"}`} style={{ width: `${item.count ? Math.max(3, item.count / max * 100) : 2}%` }} /></div></div>)}
          </div>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
          <h2 className="text-lg font-black">Sequência simulada</h2><p className="mt-1 text-sm text-slate-500">As primeiras escolhas previstas pelo ciclo atual.</p>
          <div className="mt-4 max-h-[32rem] overflow-auto rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900">{debug.simulation.map((row) => <p key={row.session} className="border-b border-slate-200 py-2 last:border-0 dark:border-slate-800"><b>#{row.session}</b> · {row.discipline} → {row.subject}</p>)}</div>
        </article>
      </section>
    </div>
  );
}

function ProjectionMetric({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <article className={`rounded-2xl p-4 ${emphasized ? "bg-white text-primary" : "bg-white/10"}`}><p className={`text-xs font-black uppercase tracking-wider ${emphasized ? "text-primary/70" : "text-white/65"}`}>{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}
