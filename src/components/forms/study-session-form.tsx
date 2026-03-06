"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

type CycleOption = {
  id: string;
  orderIndex: number;
  active: boolean;
  subject: {
    name: string;
    weight: number;
    notes: string | null;
    tecReference: string | null;
    discipline: {
      name: string;
    };
  };
};

export function StudySessionForm({
  cycleEntries,
  suggestedId,
}: {
  cycleEntries: CycleOption[];
  suggestedId?: string;
}) {
  const [cycleEntryId, setCycleEntryId] = useState(suggestedId ?? cycleEntries[0]?.id ?? "");
  const [questions, setQuestions] = useState(20);
  const [correct, setCorrect] = useState(14);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => cycleEntries.find((entry) => entry.id === cycleEntryId),
    [cycleEntries, cycleEntryId],
  );

  const wrong = Math.max(0, questions - correct);
  const percentage = questions > 0 ? (correct / questions) * 100 : 0;

  async function submit() {
    if (!cycleEntryId) {
      toast.error("Selecione um assunto do ciclo.");
      return;
    }

    if (correct > questions) {
      toast.error("Acertos não pode ser maior que questões.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cycleEntryId,
        date,
        questions,
        correct,
        wrong,
        notes,
      }),
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      toast.error(data.message ?? "Erro ao salvar registro.");
      return;
    }

    toast.success("Registro salvo com sucesso.");
    setNotes("");
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-card border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-black text-ink dark:text-white">Registro diário de estudo</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Data
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Assunto do ciclo
            <select
              value={cycleEntryId}
              onChange={(e) => setCycleEntryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {cycleEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  #{entry.orderIndex} - {entry.subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Questões
            <input
              type="number"
              min={1}
              value={questions}
              onChange={(e) => setQuestions(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Acertos
            <input
              type="number"
              min={0}
              max={questions}
              value={correct}
              onChange={(e) => setCorrect(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Observações
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={3}
            />
          </label>
        </div>
        <button onClick={submit} disabled={loading} className="mt-4 rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Salvando..." : "Salvar registro"}
        </button>
      </div>

      <div className="space-y-4">
        <article className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Preenchimento automático</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Disciplina: <span className="font-semibold">{selected?.subject.discipline.name ?? "-"}</span>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Peso: <span className="font-semibold">{selected?.subject.weight ?? "-"}</span>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Erros: <span className="font-semibold">{wrong}</span>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Percentual do dia: <span className="font-semibold">{percentage.toFixed(1)}%</span>
          </p>
        </article>
        <article className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Onde marcar no TEC</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{selected?.subject.tecReference ?? "Não informado"}</p>
          <p className="mt-2 text-xs text-slate-500">{selected?.subject.notes ?? "Sem observações"}</p>
        </article>
      </div>
    </section>
  );
}
