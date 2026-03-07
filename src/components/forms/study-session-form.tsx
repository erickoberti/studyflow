"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

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
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [loading, setLoading] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const selected = useMemo(
    () => cycleEntries.find((entry) => entry.id === cycleEntryId),
    [cycleEntries, cycleEntryId],
  );

  const wrong = Math.max(0, questions - correct);
  const percentage = questions > 0 ? (correct / questions) * 100 : 0;
  const scoreLabel = percentage >= 80 ? "MUITO BOM" : percentage >= 70 ? "BOM" : percentage >= 60 ? "ATENCAO" : "URGENTE";

  async function submit() {
    if (!cycleEntryId) {
      toast.error("Selecione um assunto do ciclo.");
      return;
    }

    if (correct > questions) {
      toast.error("Acertos nao pode ser maior que questoes.");
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
        estimatedMinutes,
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
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Data do estudo
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-[#120e20] px-4 py-3 text-white outline-none focus:border-primary"
              />
            </label>

            <label className="text-sm text-slate-300">
              Assunto (do ciclo)
              <select
                value={cycleEntryId}
                onChange={(e) => setCycleEntryId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-[#120e20] px-4 py-3 text-white outline-none focus:border-primary"
              >
                {cycleEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    #{entry.orderIndex} - {entry.subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Disciplina
              <input
                readOnly
                value={selected?.subject.discipline.name ?? "-"}
                className="mt-2 w-full rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-slate-300"
              />
            </label>

            <label className="text-sm text-slate-300">
              Peso
              <input
                readOnly
                value={selected?.subject.weight ?? "-"}
                className="mt-2 w-full rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-slate-300"
              />
            </label>

            <label className="text-sm text-slate-300">
              Quantidade de questoes
              <input
                type="number"
                min={1}
                value={questions}
                onChange={(e) => setQuestions(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-[#120e20] px-4 py-3 text-white"
              />
            </label>

            <label className="text-sm text-slate-300">
              Quantidade de acertos
              <input
                type="number"
                min={0}
                max={questions}
                value={correct}
                onChange={(e) => setCorrect(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-[#120e20] px-4 py-3 text-white"
              />
            </label>

            <label className="text-sm text-slate-300">
              Tempo estudado (min)
              <input
                type="number"
                min={0}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-primary/30 bg-[#120e20] px-4 py-3 text-white"
              />
            </label>

            <label className="text-sm text-slate-300 md:col-span-2">
              Observacoes / pontos de atencao
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-lg border border-primary/30 bg-[#120e20] px-4 py-3 text-white"
                placeholder="O que voce sentiu dificuldade nesta sessao?"
              />
            </label>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-soft disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar registro"}
          </button>
        </article>
      </div>

      <div className="space-y-6">
        <article className="rounded-2xl bg-gradient-to-br from-primary to-[#6d38e0] p-6 text-white shadow-soft">
          <p className="text-sm text-white/80">Aproveitamento atual</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-5xl font-black">{percentage.toFixed(0)}%</span>
            <span className="mb-2 rounded bg-white/20 px-2 py-1 text-xs font-bold">{scoreLabel}</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, percentage)}%` }} />
          </div>
          <p className="mt-3 text-xs text-white/80">Calculado com base em {correct} acertos de {questions} questoes.</p>
        </article>

        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-6">
          <h3 className="text-lg font-bold text-white">Cronometro de estudo</h3>
          <p className="mt-2 text-4xl font-black text-primarySoft">{formatClock(elapsedSeconds)}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((prev) => !prev)}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
            >
              {isRunning ? "Pausar" : "Iniciar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRunning(false);
                setElapsedSeconds(0);
              }}
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primarySoft"
            >
              Zerar
            </button>
            <button
              type="button"
              onClick={() => setEstimatedMinutes(Math.max(1, Math.round(elapsedSeconds / 60)))}
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primarySoft"
            >
              Usar tempo
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">Clique em Usar tempo para preencher os minutos do registro automaticamente.</p>
        </article>

        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-6">
          <h3 className="text-lg font-bold text-white">Estatisticas do assunto</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Disciplina</span>
              <span className="font-semibold">{selected?.subject.discipline.name ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Peso</span>
              <span className="font-semibold">{selected?.subject.weight ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Erros</span>
              <span className="font-semibold text-red-300">{wrong}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Percentual do dia</span>
              <span className="font-semibold">{percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-5 border-t border-primary/20 pt-4 text-sm text-slate-400">
            <p className="font-semibold text-slate-300">Onde marcar no TEC</p>
            <p className="mt-1">{selected?.subject.tecReference ?? "Nao informado"}</p>
            <p className="mt-2 text-xs">{selected?.subject.notes ?? "Sem observacoes"}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

