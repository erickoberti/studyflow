"use client";

import { useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type SessionItem = {
  id: string;
  cycleEntryId: string;
  date: string;
  questions: number;
  correct: number;
  wrong: number;
  percentage: number;
  estimatedMinutes: number;
  notes: string;
  subjectName: string;
  disciplineName: string;
};

type EntryItem = {
  id: string;
  orderIndex: number;
  subjectName: string;
  disciplineName: string;
};

function dayKeySaoPaulo(dateIso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateIso));
}

function formatPtBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateIso));
}

export function SessionManager({ sessions, cycleEntries }: { sessions: SessionItem[]; cycleEntries: EntryItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    cycleEntryId: cycleEntries[0]?.id ?? "",
    date: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    questions: 0,
    correct: 0,
    estimatedMinutes: 60,
    notes: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      [s.disciplineName, s.subjectName, formatPtBr(s.date), String(s.questions)].join(" ").toLowerCase().includes(q),
    );
  }, [sessions, query]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function startEdit(item: SessionItem) {
    setEditingId(item.id);
    setForm({
      id: item.id,
      cycleEntryId: item.cycleEntryId,
      date: dayKeySaoPaulo(item.date),
      questions: item.questions,
      correct: item.correct,
      estimatedMinutes: item.estimatedMinutes,
      notes: item.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEdit() {
    if (!form.cycleEntryId || form.questions <= 0 || form.correct > form.questions) {
      toast.error("Preencha os dados corretamente.");
      return;
    }

    setSaving(true);
    const wrong = Math.max(0, form.questions - form.correct);
    const response = await fetch("/api/study-sessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        cycleEntryId: form.cycleEntryId,
        date: form.date,
        questions: form.questions,
        correct: form.correct,
        wrong,
        estimatedMinutes: form.estimatedMinutes,
        notes: form.notes,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(data.message ?? "Erro ao salvar alteração.");
      return;
    }

    toast.success("Registro atualizado.");
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-[#161126]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Pencil size={14} /> {editingId ? "Editando registro" : "Selecione um registro para editar"}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-semibold text-slate-500">
            Data
            <input type="date" value={form.date} onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-primary/30 dark:bg-[#120e20]" />
          </label>
          <label className="text-xs font-semibold text-slate-500 xl:col-span-2">
            Assunto do ciclo
            <select value={form.cycleEntryId} onChange={(e) => setForm((v) => ({ ...v, cycleEntryId: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-primary/30 dark:bg-[#120e20]">
              {cycleEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>#{entry.orderIndex} - {entry.disciplineName} / {entry.subjectName}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Questões
            <input type="number" min={1} value={form.questions} onChange={(e) => setForm((v) => ({ ...v, questions: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-primary/30 dark:bg-[#120e20]" />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Acertos
            <input type="number" min={0} max={form.questions} value={form.correct} onChange={(e) => setForm((v) => ({ ...v, correct: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-primary/30 dark:bg-[#120e20]" />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
          <label className="text-xs font-semibold text-slate-500">
            Tempo (min)
            <input type="number" min={1} value={form.estimatedMinutes} onChange={(e) => setForm((v) => ({ ...v, estimatedMinutes: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-primary/30 dark:bg-[#120e20]" />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Observações
            <input value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-primary/30 dark:bg-[#120e20]" />
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={saveEdit} disabled={!editingId || saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar alteração"}</button>
          <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-primary/30 dark:text-slate-300">Cancelar</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-[#161126]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Todos os registros ({filtered.length})</h2>
          <label className="relative w-full md:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filtrar por disciplina/assunto/data" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm dark:border-primary/30 dark:bg-[#120e20]" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Data</th>
                <th className="py-2">Disciplina</th>
                <th className="py-2">Assunto</th>
                <th className="py-2 text-right">Questões</th>
                <th className="py-2 text-right">Acertos</th>
                <th className="py-2 text-right">%</th>
                <th className="py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-primary/15">
              {pageItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300">{formatPtBr(item.date)}</td>
                  <td className="py-2.5 font-medium">{item.disciplineName}</td>
                  <td className="py-2.5">{item.subjectName}</td>
                  <td className="py-2.5 text-right">{item.questions}</td>
                  <td className="py-2.5 text-right">{item.correct}</td>
                  <td className="py-2.5 text-right">{item.percentage.toFixed(1)}%</td>
                  <td className="py-2.5 text-right">
                    <button type="button" onClick={() => startEdit(item)} className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-1">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md px-3 py-1 text-xs font-bold text-slate-500 hover:bg-primary/10">{"<"}</button>
          {Array.from({ length: totalPages }).slice(0, 8).map((_, idx) => {
            const p = idx + 1;
            const active = p === currentPage;
            return (
              <button key={p} type="button" onClick={() => setPage(p)} className={`rounded-md px-3 py-1 text-xs font-bold ${active ? "bg-primary text-white" : "text-slate-500 hover:bg-primary/10"}`}>
                {p}
              </button>
            );
          })}
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md px-3 py-1 text-xs font-bold text-slate-500 hover:bg-primary/10">{">"}</button>
        </div>
      </div>
    </div>
  );
}
