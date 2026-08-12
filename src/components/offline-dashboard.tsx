"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Library, Target, Zap } from "lucide-react";
import { getOfflineDashboard, getOfflineNextSuggestion } from "@/lib/offline/analytics";
import { getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { getActiveOfflineGuide, getOfflineDisciplines } from "@/lib/offline/selectors";

export function OfflineDashboard() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);

  const dashboard = getOfflineDashboard(snapshot);
  const suggestion = getOfflineNextSuggestion(snapshot);
  const activeGuide = getActiveOfflineGuide(snapshot);

  return (
    <div className="space-y-6 pb-10">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm text-slate-500">Horas estudadas</p>
          <p className="mt-2 text-4xl font-black">{(dashboard.totals.totalEstimatedMinutes / 60).toFixed(1)}h</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm text-slate-500">Disciplinas ativas</p>
          <p className="mt-2 text-4xl font-black">{getOfflineDisciplines(snapshot, activeGuide?.id).filter((discipline) => discipline.active).length}</p>
          <Library size={18} className="mt-3 text-primary" />
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm text-slate-500">Sequência</p>
          <p className="mt-2 text-4xl font-black">{dashboard.totals.streakDays} dias</p>
          <Flame size={18} className="mt-3 text-orange-500" />
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm text-slate-500">Indice de foco</p>
          <p className="mt-2 text-4xl font-black">{dashboard.totals.overallPercentage.toFixed(1)}%</p>
          <Target size={18} className="mt-3 text-primary" />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">Últimos dias</h2>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
              Meta: {snapshot.settings?.dailyQuestionsGoal ?? 30} questões
            </span>
          </div>

          <div className="flex h-48 items-end gap-2">
            {dashboard.byDay.slice(-7).map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end rounded-t-2xl bg-primary/15" style={{ height: `${Math.max(16, day.questions)}px` }}>
                  <div className="w-full rounded-t-2xl bg-primary" style={{ height: `${Math.min(160, day.questions * 2)}px` }} />
                </div>
                <span className="text-[11px] font-bold text-slate-500">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl bg-gradient-to-br from-primary to-primarySoft p-6 text-white shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/80">Próximo tópico</p>
          <h3 className="mt-2 text-3xl font-black">{suggestion.next?.subject.name ?? "Organize seu ciclo"}</h3>
          <p className="mt-2 text-sm text-white/85">
            {suggestion.next?.subject.discipline.name ?? "Adicione um guia e pelo menos um assunto para seguir estudando offline."}
          </p>
          <p className="mt-4 text-sm text-white/90">{suggestion.next?.subject.notes ?? "A sincronização vai manter seus dados locais e do servidor alinhados quando a conexão voltar."}</p>
          <Link href="/offline/registro" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-primary">
            <Zap size={14} />
            Registrar sessão
          </Link>
        </article>
      </section>
    </div>
  );
}
