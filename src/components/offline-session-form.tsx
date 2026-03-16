"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createOfflineSession, getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { getOfflineNextSuggestion } from "@/lib/offline/analytics";
import { expandOfflineEntry, getActiveOfflineGuide, getDisciplineMap, getOfflineCycleEntries, getSubjectMap } from "@/lib/offline/selectors";

function dayKeySaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function OfflineSessionForm() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const suggestion = getOfflineNextSuggestion(snapshot);
  const activeGuide = getActiveOfflineGuide(snapshot);
  const subjectMap = getSubjectMap(snapshot);
  const disciplineMap = getDisciplineMap(snapshot);
  const activeEntries = getOfflineCycleEntries(snapshot, activeGuide?.id)
    .filter((entry) => entry.active && Boolean(entry.serverId))
    .map((entry) => expandOfflineEntry(entry, subjectMap, disciplineMap))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const [cycleEntryId, setCycleEntryId] = useState(activeEntries[0]?.id ?? "");
  const [date, setDate] = useState(dayKeySaoPaulo(new Date()));
  const [questions, setQuestions] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    return subscribeOfflineStore(() => {
      const nextSnapshot = getOfflineSnapshot();
      setSnapshot(nextSnapshot);
      const nextSuggestion = getOfflineNextSuggestion(nextSnapshot);
      const nextEntries = getOfflineCycleEntries(nextSnapshot, getActiveOfflineGuide(nextSnapshot)?.id).filter((entry) => Boolean(entry.serverId));
      setCycleEntryId((current) => current || nextSuggestion.next?.id || nextEntries[0]?.id || "");
    });
  }, []);

  function submit() {
    if (!cycleEntryId) {
      toast.error("Selecione um assunto do ciclo.");
      return;
    }
    if (questions <= 0) {
      toast.error("Informe a quantidade de questoes.");
      return;
    }
    if (correct > questions) {
      toast.error("Acertos nao podem ser maiores que questoes.");
      return;
    }

    createOfflineSession({
      cycleEntryId,
      date,
      questions,
      correct,
      wrong: Math.max(0, questions - correct),
      estimatedMinutes,
      notes: notes.trim() || null,
    });

    toast.success("Sessao salva localmente. Ela sera sincronizada quando o app estiver online.");
    setQuestions(0);
    setCorrect(0);
    setEstimatedMinutes(60);
    setNotes("");
    const nextSnapshot = getOfflineSnapshot();
    const nextSuggestion = getOfflineNextSuggestion(nextSnapshot);
    const nextEntries = getOfflineCycleEntries(nextSnapshot, getActiveOfflineGuide(nextSnapshot)?.id).filter((entry) => Boolean(entry.serverId));
    setCycleEntryId(nextSuggestion.next?.id ?? nextEntries[0]?.id ?? "");
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Registro offline</p>
        <h2 className="mt-2 text-3xl font-black">Salvar sessao local</h2>
        <p className="mt-2 text-sm text-slate-500">O registro fica guardado neste dispositivo e entra na fila de sincronizacao.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Data
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Assunto
            <select
              value={cycleEntryId}
              onChange={(event) => setCycleEntryId(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {activeEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  #{entry.orderIndex} - {entry.subject.discipline.name} / {entry.subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Questoes
            <input
              type="number"
              min={0}
              value={questions}
              onChange={(event) => setQuestions(Number(event.target.value) || 0)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Acertos
            <input
              type="number"
              min={0}
              max={questions}
              value={correct}
              onChange={(event) => setCorrect(Number(event.target.value) || 0)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">
            Tempo estimado (min)
            <input
              type="number"
              min={1}
              value={estimatedMinutes}
              onChange={(event) => setEstimatedMinutes(Number(event.target.value) || 0)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Notas
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            className="mt-1.5 w-full rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <button
          type="button"
          onClick={submit}
          className="mt-5 rounded-full bg-primary px-5 py-3 text-sm font-black text-white"
        >
          Salvar localmente
        </button>
      </article>

      <aside className="space-y-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm text-slate-500">Proxima sugestao</p>
          <h3 className="mt-2 text-xl font-black">{suggestion.next?.subject.name ?? "Sem sugestao"}</h3>
          <p className="mt-1 text-sm text-slate-500">{suggestion.next?.subject.discipline.name ?? "Monte o ciclo para continuar"}</p>
        </article>
        <article className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-sm text-white/70">Pendencias</p>
          <p className="mt-2 text-4xl font-black">
            {snapshot.sessions.filter((session) => session.syncStatus !== "synced").length}
          </p>
          <p className="mt-2 text-sm text-white/80">Assim que o app encontrar conexao e autenticacao valida, ele envia tudo para o servidor.</p>
        </article>
      </aside>
    </div>
  );
}
