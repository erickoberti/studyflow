"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getOfflineSnapshot, subscribeOfflineStore, updateOfflineSettings } from "@/lib/offline/store";
import { getActiveOfflineGuide } from "@/lib/offline/selectors";

export function OfflineSettingsForm() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const activeGuide = getActiveOfflineGuide(snapshot);
  const [form, setForm] = useState({
    dailyQuestionsGoal: "30",
    weeklyQuestionsGoal: "200",
    targetPercentage: "80",
    weightPriorityBias: "1.25",
  });

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);

  useEffect(() => {
    setForm({
      dailyQuestionsGoal: String(snapshot.settings?.dailyQuestionsGoal ?? 30),
      weeklyQuestionsGoal: String(snapshot.settings?.weeklyQuestionsGoal ?? 200),
      targetPercentage: String(snapshot.settings?.targetPercentage ?? 80),
      weightPriorityBias: String(snapshot.settings?.weightPriorityBias ?? 1.25),
    });
  }, [snapshot.settings]);

  function save() {
    if (!activeGuide) {
      toast.error("Selecione um guia.");
      return;
    }

    updateOfflineSettings({
      guideId: activeGuide.id,
      dailyQuestionsGoal: Number(form.dailyQuestionsGoal) || 30,
      weeklyQuestionsGoal: Number(form.weeklyQuestionsGoal) || 200,
      targetPercentage: Number(form.targetPercentage) || 80,
      weightPriorityBias: Number(form.weightPriorityBias) || 1.25,
    });
    toast.success("Configurações salvas localmente.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] pb-10">
      <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <h2 className="text-2xl font-black">Configurações offline</h2>
        <p className="mt-1 text-sm text-slate-500">Esses valores ficam locais e entram na próxima sincronização.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            Meta diaria
            <input value={form.dailyQuestionsGoal} onChange={(event) => setForm((current) => ({ ...current, dailyQuestionsGoal: event.target.value }))} type="number" className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 px-3" />
          </label>
          <label className="text-sm font-semibold">
            Meta semanal
            <input value={form.weeklyQuestionsGoal} onChange={(event) => setForm((current) => ({ ...current, weeklyQuestionsGoal: event.target.value }))} type="number" className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 px-3" />
          </label>
          <label className="text-sm font-semibold">
            Meta de acerto
            <input value={form.targetPercentage} onChange={(event) => setForm((current) => ({ ...current, targetPercentage: event.target.value }))} type="number" className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 px-3" />
          </label>
          <label className="text-sm font-semibold">
            Vies de prioridade
            <input value={form.weightPriorityBias} onChange={(event) => setForm((current) => ({ ...current, weightPriorityBias: event.target.value }))} type="number" step="0.05" className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 px-3" />
          </label>
        </div>

        <button type="button" onClick={save} className="mt-5 rounded-full bg-primary px-5 py-3 text-sm font-black text-white">
          Salvar localmente
        </button>
      </article>

      <article className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-sm text-white/70">Guia ativo</p>
        <p className="mt-2 text-2xl font-black">{activeGuide?.name ?? "Sem guia"}</p>
        <p className="mt-3 text-sm text-white/80">{snapshot.pendingOperations.length} alteração(ões) estrutural(is) aguardando sincronização.</p>
      </article>
    </div>
  );
}
