"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Clock3, LineChart, Pencil, TrendingUp } from "lucide-react";
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

type RecentSession = {
  id: string;
  date: Date;
  questions: number;
  correct: number;
  wrong: number;
  estimatedMinutes: number;
  notes: string | null;
  cycleEntryId: string;
  cycleEntry: {
    subject: {
      name: string;
      discipline: {
        name: string;
      };
    };
  };
};

function formatPtBrDay(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function dayKeySaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nextCycleId(cycleEntries: CycleOption[], currentId: string) {
  const ordered = [...cycleEntries].sort((a, b) => a.orderIndex - b.orderIndex);
  const idx = ordered.findIndex((entry) => entry.id === currentId);
  if (idx === -1) return currentId;
  return ordered[(idx + 1) % ordered.length]?.id ?? currentId;
}

function signalByPercentage(percentage: number) {
  if (percentage >= 80) return { cls: "text-emerald-600", bg: "bg-emerald-500", label: "Excelente" };
  if (percentage >= 70) return { cls: "text-amber-600", bg: "bg-amber-500", label: "Bom" };
  return { cls: "text-red-600", bg: "bg-red-500", label: "Ajustar" };
}

export function StudySessionForm({
  cycleEntries,
  suggestedId,
  recentSessions,
}: {
  cycleEntries: CycleOption[];
  suggestedId?: string;
  recentSessions?: RecentSession[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cycleEntryId, setCycleEntryId] = useState(suggestedId ?? cycleEntries[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [loading, setLoading] = useState(false);

  const wrong = Math.max(0, questions - correct);
  const percentage = questions > 0 ? (correct / questions) * 100 : 0;
  const signal = signalByPercentage(percentage);

  const dailyQuestionsTarget = 50;
  const questionProgress = Math.min(100, (questions / dailyQuestionsTarget) * 100);

  const headline = useMemo(() => (editingId ? "Salvar Alterações" : "Salvar Registro"), [editingId]);

  function resetForm() {
    setEditingId(null);
    setTopic("");
    setNotes("");
    setQuestions(0);
    setCorrect(0);
    setEstimatedMinutes(60);
    setCycleEntryId(suggestedId ?? cycleEntries[0]?.id ?? "");
    setDate(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
  }

  function startEdit(session: RecentSession) {
    setEditingId(session.id);
    setCycleEntryId(session.cycleEntryId);
    setDate(dayKeySaoPaulo(new Date(session.date)));
    setQuestions(session.questions);
    setCorrect(session.correct);
    setEstimatedMinutes(session.estimatedMinutes || 60);
    setNotes(session.notes ?? "");
    setTopic("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!cycleEntryId) {
      toast.error("Selecione um assunto do ciclo.");
      return;
    }

    if (questions <= 0) {
      toast.error("Informe a quantidade de questões.");
      return;
    }

    if (correct > questions) {
      toast.error("Acertos não podem ser maiores que questões.");
      return;
    }

    const payload = {
      id: editingId ?? undefined,
      cycleEntryId,
      date,
      questions,
      correct,
      wrong,
      notes: [topic, notes].filter(Boolean).join(" | "),
      estimatedMinutes,
    };

    setLoading(true);
    const response = await fetch("/api/study-sessions", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.message ?? "Erro ao salvar registro.");
      return;
    }

    toast.success(editingId ? "Registro atualizado com sucesso." : "Registro salvo com sucesso.");

    if (editingId) {
      resetForm();
    } else {
      setTopic("");
      setNotes("");
      setQuestions(0);
      setCorrect(0);
      setEstimatedMinutes(60);
      setCycleEntryId((prev) => nextCycleId(cycleEntries, prev));
    }

    router.refresh();
  }

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_330px]">
      <div className="space-y-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-primary/20 dark:bg-[#161126]">
          {editingId ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              Você está editando um registro existente.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data da Sessão
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Disciplina
              <select
                value={cycleEntryId}
                onChange={(e) => setCycleEntryId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              >
                {cycleEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    #{entry.orderIndex} - {entry.subject.discipline.name} / {entry.subject.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tópico Estudado
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Logaritmos, Revolução Francesa..."
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
            />
          </label>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tempo (min)
              <input
                type="number"
                min={1}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value) || 0)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Total de Questões
              <input
                type="number"
                min={0}
                value={questions}
                onChange={(e) => setQuestions(Number(e.target.value) || 0)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-green-700 dark:text-green-300">
              Acertos
              <input
                type="number"
                min={0}
                max={questions}
                value={correct}
                onChange={(e) => setCorrect(Number(e.target.value) || 0)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </label>
            <label className="text-sm font-semibold text-red-700 dark:text-red-300">
              Erros
              <input
                type="number"
                readOnly
                value={wrong}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-slate-700 dark:border-primary/30 dark:bg-[#191333] dark:text-slate-200"
              />
            </label>
          </div>

          <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Anotações e Dificuldades
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Escreva aqui os pontos principais ou dúvidas que surgiram..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-primary dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
            />
          </label>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#20173a]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Salvando..." : headline}
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#161126]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Registros Recentes</h3>
            <Link href="/registros" className="text-xs font-bold text-primary hover:underline">Ver todos e editar</Link>
          </div>
          {recentSessions && recentSessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Disciplina</th>
                    <th className="py-2">Assunto</th>
                    <th className="py-2 text-right">Questões</th>
                    <th className="py-2 text-right">Acertos</th>
                    <th className="py-2 text-right">Data</th>
                    <th className="py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-primary/15">
                  {recentSessions.map((session) => (
                    <tr key={session.id}>
                      <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{session.cycleEntry.subject.discipline.name}</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">{session.cycleEntry.subject.name}</td>
                      <td className="py-2.5 text-right">{session.questions}</td>
                      <td className="py-2.5 text-right">{session.correct}</td>
                      <td className="py-2.5 text-right text-slate-500">{formatPtBrDay(session.date)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(session)}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sem registros recentes.</p>
          )}
        </article>
      </div>

      <aside className="space-y-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#161126]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-[0.08em] text-slate-700 dark:text-slate-200">Desempenho automático</h3>
            <LineChart size={16} className="text-primary" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><Clock3 size={14} className="text-primary" />Tempo Total</span>
              <span className="text-xl font-black text-primary">{Math.floor(estimatedMinutes / 60)}h {String(estimatedMinutes % 60).padStart(2, "0")}m</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-500/15">
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><CheckCircle2 size={14} className="text-emerald-500" />Taxa de Acerto</span>
              <span className={`text-xl font-black ${signal.cls}`}>{percentage.toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-500/15">
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><TrendingUp size={14} className="text-amber-500" />Meta Diária</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-300">{Math.min(100, ((correct / Math.max(1, questions)) * 100)).toFixed(0)}%</span>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-primary/20">
            <h4 className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Meta de Questões</h4>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#221a36]">
              <div className={`h-full rounded-full ${signal.bg}`} style={{ width: `${questionProgress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">{questions}/{dailyQuestionsTarget} resolvidas</span>
              <span className="font-bold text-primary">{questionProgress.toFixed(0)}%</span>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-[#161126]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{format(new Date(), "MMMM yyyy")}</h3>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: 35 }).map((_, idx) => {
              const day = idx - 1;
              const active = day === Number(date.slice(-2));
              return (
                <span
                  key={idx}
                  className={`rounded-md py-1.5 ${
                    day > 0 ? (active ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300") : "text-slate-300"
                  }`}
                >
                  {day > 0 ? day : ""}
                </span>
              );
            })}
          </div>
          <a href="/ciclo" className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary">
            Ver Cronograma Completo
          </a>
        </article>

        <article className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-soft">
          <div className="relative z-10">
            <span className="rounded bg-primary px-2 py-1 text-[10px] font-black uppercase">Pro Plan</span>
            <h4 className="mt-3 text-3xl font-black leading-tight">Análise de IA Avançada</h4>
            <p className="mt-2 text-sm text-slate-300">Identifique lacunas no seu conhecimento com nossa inteligência artificial.</p>
            <button className="mt-4 text-sm font-bold text-white underline-offset-4 hover:underline">Saiba mais</button>
          </div>
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        </article>
      </aside>
    </section>
  );
}
