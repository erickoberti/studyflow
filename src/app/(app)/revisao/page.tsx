import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { getReviewSuggestions } from "@/lib/analytics";

function when(date: Date | null) {
  if (!date) return "Sem registro";
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export default async function RevisaoPage() {
  const user = await requireUser();
  const data = await getReviewSuggestions(user.id);

  const cardsToday = data.weak.length + data.stale.length;
  const avgWeak = data.weak.length
    ? data.weak.reduce((sum, item) => sum + item.percentage, 0) / data.weak.length
    : 0;

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <header>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white">Painel de Revisão</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Otimize seu aprendizado focando nos tópicos mais críticos.</p>
      </header>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-[#161126]">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Sugestão de prioridade</p>
            {data.weak[0] ? (
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                <div className="rounded-xl bg-gradient-to-br from-primary to-[#6d38e0] p-4 text-white">
                  <p className="text-xs font-bold uppercase">Alta urgência</p>
                  <p className="mt-6 text-4xl font-black">Σ</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">{data.weak[0].discipline}</p>
                  <h2 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{data.weak[0].subject}</h2>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">Você está com baixo desempenho e sem revisão recente nesse tópico.</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-slate-500">Último estudo: {when(data.weak[0].lastStudy)}</p>
                    <button className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">Iniciar agora</button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-slate-500">Sem dados de revisão ainda.</p>
            )}
          </article>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Matérias pendentes</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.stale.slice(0, 4).map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{item.discipline}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.subject}</p>
                  <p className="mt-2 text-xs text-slate-500">Último estudo: {when(item.lastStudy)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <p className="text-xs uppercase tracking-wider text-slate-500">Média semanal</p>
              <p className="mt-1 text-4xl font-black text-slate-900 dark:text-white">{avgWeak.toFixed(0)}%</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <p className="text-xs uppercase tracking-wider text-slate-500">Horas estudadas</p>
              <p className="mt-1 text-4xl font-black text-slate-900 dark:text-white">28.5h</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <p className="text-xs uppercase tracking-wider text-slate-500">Cards de revisão</p>
              <p className="mt-1 text-4xl font-black text-slate-900 dark:text-white">{cardsToday}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <p className="text-xs uppercase tracking-wider text-slate-500">Ofensiva</p>
              <p className="mt-1 text-4xl font-black text-slate-900 dark:text-white">12 dias</p>
            </article>
          </section>
        </div>

        <aside className="rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-500/20 dark:bg-[#0d1a33]">
          <h3 className="text-3xl font-black text-red-600 dark:text-red-400">Zonas de alerta</h3>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Tópicos com desempenho abaixo de 60% recentemente.</p>
          <div className="mt-5 space-y-4">
            {data.weak.slice(0, 5).map((item) => (
              <div key={item.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-800 dark:text-slate-200">{item.discipline}: {item.subject}</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{item.percentage.toFixed(0)}% acerto</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-2 rounded-full ${item.percentage < 50 ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${Math.max(8, item.percentage)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary">Reforçar tópicos críticos</button>
          <p className="mt-4 text-xs text-slate-500">Usuário: {user.name ?? "Aluno"}</p>
        </aside>
      </section>
    </div>
  );
}
