"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Pencil,
  TrendingUp,
  XCircle,
} from "lucide-react";
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
  if (percentage >= 80) return { cls: "text-emerald-600", bg: "bg-emerald-500" };
  if (percentage >= 70) return { cls: "text-amber-600", bg: "bg-amber-500" };
  return { cls: "text-red-600", bg: "bg-red-500" };
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
  const [date, setDate] = useState(() => dayKeySaoPaulo(new Date()));
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [loading, setLoading] = useState(false);

  const wrong = Math.max(0, questions - correct);
  const percentage = questions > 0 ? (correct / questions) * 100 : 0;
  const signal = signalByPercentage(percentage);

  const dailyQuestionsTarget = 50;
  const questionProgress = Math.min(100, (questions / dailyQuestionsTarget) * 100);
  const headline = useMemo(() => (editingId ? "Salvar Alterações" : "Salvar Sessão"), [editingId]);

  function resetForm() {
    setEditingId(null);
    setTopic("");
    setNotes("");
    setQuestions(0);
    setCorrect(0);
    setEstimatedMinutes(60);
    setCycleEntryId(suggestedId ?? cycleEntries[0]?.id ?? "");
    setDate(dayKeySaoPaulo(new Date()));
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
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <h2 className="mb-5 inline-flex items-center gap-2 text-3xl font-black text-slate-900 dark:text-white">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white text-sm">i</span>
            Detalhes do Estudo
          </h2>

          {editingId ? (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              Você está editando um registro existente.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Data da Sessão
              <div className="relative mt-1.5">
                <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </label>

            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Matéria
              <select
                value={cycleEntryId}
                onChange={(e) => setCycleEntryId(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
            Tópico de Estudo
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Controle de Constitucionalidade"
              className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tempo (min)
              <input type="number" min={1} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value) || 0)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Total Questões
              <input type="number" min={0} value={questions} onChange={(e) => setQuestions(Number(e.target.value) || 0)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <label className="text-sm font-semibold text-green-700 dark:text-green-300">
              Acertos
              <input type="number" min={0} max={questions} value={correct} onChange={(e) => setCorrect(Number(e.target.value) || 0)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <label className="text-sm font-semibold text-red-700 dark:text-red-300">
              Erros
              <input type="number" readOnly value={wrong} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 dark:border-slate-700 dark:bg-slate-800/80" />
            </label>
          </div>

          <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Notas e Dificuldades
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Descreva o que aprendeu ou as principais dúvidas encontradas..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-200">Cancelar</button>
            <button type="button" onClick={submit} disabled={loading} className="rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white shadow-soft disabled:opacity-60">
              {loading ? "Salvando..." : headline}
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Registros Recentes</h3>
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
                    <th className="py-2 text-right">Data</th>
                    <th className="py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentSessions.map((session) => (
                    <tr key={session.id}>
                      <td className="py-2.5 font-medium">{session.cycleEntry.subject.discipline.name}</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">{session.cycleEntry.subject.name}</td>
                      <td className="py-2.5 text-right">{session.questions}</td>
                      <td className="py-2.5 text-right text-slate-500">{formatPtBrDay(session.date)}</td>
                      <td className="py-2.5 text-right">
                        <button type="button" onClick={() => startEdit(session)} className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20">
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
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <h3 className="mb-4 text-3xl font-black text-slate-900 dark:text-white">Progresso Diário</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-slate-500">Horas Estudadas</span><span className="font-bold">{(estimatedMinutes / 60).toFixed(1)} / 6h</span></div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (estimatedMinutes / 360) * 100)}%` }} /></div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-slate-500">Questões Realizadas</span><span className="font-bold">{questions} / {dailyQuestionsTarget}</span></div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-2 rounded-full ${signal.bg}`} style={{ width: `${questionProgress}%` }} /></div>
            </div>
            <div className="pt-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"><Flame size={18} /></div>
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">12 Dias de Streak!</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Mantenha o foco</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <h3 className="mb-4 text-3xl font-black text-slate-900 dark:text-white">Métricas Calculadas</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span className="inline-flex items-center gap-2 text-sm"><Clock3 size={14} className="text-primary" /> Produtividade</span>
              <span className="font-bold">{(questions > 0 ? questions / Math.max(1, estimatedMinutes) : 0).toFixed(1)} q/min</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span className="inline-flex items-center gap-2 text-sm"><TrendingUp size={14} className="text-amber-500" /> Evolução</span>
              <span className="font-bold text-emerald-500">+{(percentage / 15).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span className="inline-flex items-center gap-2 text-sm"><CheckCircle2 size={14} className="text-emerald-500" /> Retenção</span>
              <span className={`font-bold ${signal.cls}`}>{percentage >= 80 ? "Alta" : percentage >= 70 ? "Média" : "Baixa"}</span>
            </div>
          </div>
        </article>

        <article className="rounded-xl bg-gradient-to-br from-primary to-primarySoft p-5 text-white shadow-soft">
          <h4 className="mb-2 inline-flex items-center gap-2 text-lg font-black"><XCircle size={16} /> Dica de Estudo</h4>
          <p className="text-sm text-white/90">Use sessões curtas de 25 minutos com pausa para aumentar retenção e reduzir fadiga.</p>
        </article>
      </aside>
    </section>
  );
}

