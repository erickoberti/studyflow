"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function semaforo(percentage: number) {
  if (percentage >= 80) {
    return {
      label: "MANTER",
      tone: "text-emerald-300",
      badge: "bg-emerald-500/20 text-emerald-300",
      bar: "bg-emerald-400",
    };
  }
  if (percentage >= 70) {
    return {
      label: "AJUSTAR",
      tone: "text-amber-300",
      badge: "bg-amber-500/20 text-amber-300",
      bar: "bg-amber-400",
    };
  }
  return {
    label: "URGENTE",
    tone: "text-red-300",
    badge: "bg-red-500/20 text-red-300",
    bar: "bg-red-400",
  };
}

function nextCycleId(cycleEntries: CycleOption[], currentId: string) {
  const ordered = [...cycleEntries].sort((a, b) => a.orderIndex - b.orderIndex);
  const idx = ordered.findIndex((entry) => entry.id === currentId);
  if (idx === -1) return currentId;
  return ordered[(idx + 1) % ordered.length]?.id ?? currentId;
}

export function StudySessionForm({
  cycleEntries,
  suggestedId,
}: {
  cycleEntries: CycleOption[];
  suggestedId?: string;
}) {
  const router = useRouter();
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
  const status = semaforo(percentage);

  const dailyTimeTarget = 240;
  const dailyQuestionsTarget = 20;
  const timeProgress = Math.min(100, (estimatedMinutes / dailyTimeTarget) * 100);
  const questionProgress = Math.min(100, (questions / dailyQuestionsTarget) * 100);

  async function submit() {
    if (!cycleEntryId) {
      toast.error("Selecione um assunto do ciclo.");
      return;
    }

    if (correct > questions) {
      toast.error("Acertos não podem ser maiores que questões.");
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
    setQuestions(20);
    setCorrect(14);
    setEstimatedMinutes(30);
    setCycleEntryId((prev) => nextCycleId(cycleEntries, prev));
    router.refresh();
  }

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Data do estudo
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-white outline-none focus:border-primary"
              />
            </label>

            <label className="text-sm text-slate-300">
              Assunto (do ciclo)
              <select
                value={cycleEntryId}
                onChange={(e) => setCycleEntryId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-white outline-none focus:border-primary"
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
                className="mt-1.5 w-full rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-slate-300"
              />
            </label>

            <label className="text-sm text-slate-300">
              Peso
              <input
                readOnly
                value={selected?.subject.weight ?? "-"}
                className="mt-1.5 w-full rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-slate-300"
              />
            </label>

            <label className="text-sm text-slate-300">
              Quantidade de questões
              <input
                type="number"
                min={1}
                value={questions}
                onChange={(e) => setQuestions(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-white"
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
                className="mt-1.5 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-white"
              />
            </label>

            <label className="text-sm text-slate-300">
              Tempo estudado (min)
              <input
                type="number"
                min={0}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-white"
              />
            </label>

            <label className="text-sm text-slate-300 md:col-span-2">
              Observações / pontos de atenção
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-none rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-white"
                placeholder="O que você sentiu dificuldade nesta sessão?"
              />
            </label>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-soft disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar registro"}
          </button>
        </article>
      </div>

      <div className="space-y-5">
        <article className="rounded-2xl bg-gradient-to-br from-primary to-[#6d38e0] p-5 text-white shadow-soft">
          <p className="text-sm text-white/80">Aproveitamento atual</p>
          <div className="mt-1 flex items-end gap-2">
            <span className={`text-5xl font-black ${status.tone}`}>{percentage.toFixed(0)}%</span>
            <span className={`mb-2 rounded px-2 py-1 text-xs font-bold ${status.badge}`}>{status.label}</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${Math.min(100, percentage)}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/90">Calculado com base em {correct} acertos de {questions} questões.</p>
        </article>

        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <h3 className="text-base font-bold text-white">Metas diárias</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>Tempo de estudo</span>
                <span className="font-semibold">{Math.round(estimatedMinutes / 60)}h / {Math.round(dailyTimeTarget / 60)}h</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-primary" style={{ width: `${timeProgress}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>Questões</span>
                <span className="font-semibold">{questions} / {dailyQuestionsTarget}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-primary" style={{ width: `${questionProgress}%` }} />
              </div>
            </div>
          </div>
          <a
            href="/configuracoes"
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold text-primarySoft"
          >
            Ajustar metas
          </a>
        </article>

        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <h3 className="text-base font-bold text-white">Cronômetro de estudo</h3>
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
        </article>

        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <h3 className="text-base font-bold text-white">Estatísticas do assunto</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Disciplina</span>
              <span className="font-semibold">{selected?.subject.discipline.name ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Peso</span>
              <span className="font-semibold">{selected?.subject.weight ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Acertos</span>
              <span className="font-semibold text-emerald-300">{correct}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Erros</span>
              <span className="font-semibold text-red-300">{wrong}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span>Percentual do dia</span>
              <span className={`font-semibold ${status.tone}`}>{percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-4 border-t border-primary/20 pt-3 text-sm text-slate-400">
            <p className="font-semibold text-slate-300">Onde marcar no TEC</p>
            <p className="mt-1">{selected?.subject.tecReference ?? "Não informado"}</p>
            <p className="mt-2 text-xs">{selected?.subject.notes ?? "Sem observações"}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
