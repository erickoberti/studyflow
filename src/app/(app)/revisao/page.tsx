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
    <div className="grid gap-8 pb-16 xl:grid-cols-[1fr_320px] lg:pb-0">
      <div className="space-y-8">
        <header className="rounded-2xl border border-primary/20 bg-[#161126] p-6">
          <h1 className="text-4xl font-black text-white">Central de Revisao</h1>
          <p className="mt-1 text-slate-400">Otimize sua retencao com base na curva do esquecimento.</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-primary/20 bg-[#120e20] p-4">
              <p className="text-sm text-slate-400">Cards p/ hoje</p>
              <p className="mt-1 text-3xl font-black text-white">{cardsToday}</p>
            </article>
            <article className="rounded-xl border border-primary/20 bg-[#120e20] p-4">
              <p className="text-sm text-slate-400">Taxa de acerto</p>
              <p className="mt-1 text-3xl font-black text-white">{avgWeak.toFixed(1)}%</p>
            </article>
            <article className="rounded-xl border border-primary/20 bg-[#120e20] p-4">
              <p className="text-sm text-slate-400">Tempo de revisao</p>
              <p className="mt-1 text-3xl font-black text-white">15 min</p>
            </article>
          </div>
        </header>

        <section>
          <h3 className="mb-4 text-lg font-bold text-white">Foco imediato: erros recentes</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.weak.slice(0, 4).map((item) => (
              <article key={item.id} className="rounded-xl border border-primary/20 bg-[#161126] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-300">Altas falhas</span>
                    <h4 className="mt-2 font-bold text-white">{item.discipline}</h4>
                    <p className="text-sm text-slate-400">{item.subject}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-orange-300">{item.percentage.toFixed(0)}%</span>
                    <p className="text-[10px] text-slate-500">Taxa de acerto</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Proximo em breve</p>
                  <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">Revisar agora</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-lg font-bold text-white">Curva de esquecimento: ha muito tempo</h3>
          <div className="overflow-hidden rounded-xl border border-primary/20 bg-[#161126]">
            <div className="divide-y divide-primary/10">
              {data.stale.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-primary/5">
                  <div>
                    <p className="font-semibold text-white">{item.discipline}</p>
                    <p className="text-sm text-slate-400">{item.subject}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-slate-500">Ultimo estudo: {when(item.lastStudy)}</p>
                    <button className="rounded-lg bg-primary/15 px-3 py-2 text-xs font-bold text-primarySoft">Revisar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Vistos recentemente</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {data.recent.slice(0, 6).map((item) => (
              <article key={item.id} className="rounded-xl border border-primary/20 bg-[#161126] p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">CONCLUIDO</span>
                  <span className="text-[10px] text-slate-500">{when(item.lastStudy)}</span>
                </div>
                <h4 className="mt-3 font-bold text-white">{item.discipline}</h4>
                <p className="text-sm text-slate-400">{item.subject}</p>
                <p className="mt-3 text-xs font-bold text-slate-300">{item.percentage.toFixed(1)}% acerto</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <aside className="hidden xl:flex xl:flex-col xl:gap-6">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-6 text-white shadow-soft">
          <p className="rounded bg-white/20 px-2 py-1 text-[10px] font-bold uppercase inline-block">Turbo revisao</p>
          <h3 className="mt-4 text-2xl font-black">Maratona de questoes</h3>
          <p className="mt-2 text-sm text-white/80">Baseado nos seus erros recentes.</p>
          <button className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-bold text-primary">Iniciar agora</button>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Seu progresso</h4>
          <p className="mt-3 text-xs text-slate-500">Meta semanal</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/15">
            <div className="h-full w-3/4 rounded-full bg-primary" />
          </div>
          <p className="mt-3 text-xs text-slate-400">Faltam alguns cards para bater a meta.</p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-[#161126] p-4">
          <p className="text-sm font-semibold text-white">{user.name ?? "Aluno"}</p>
          <p className="text-xs text-slate-500">Mestre dos cards</p>
        </div>
      </aside>
    </div>
  );
}
