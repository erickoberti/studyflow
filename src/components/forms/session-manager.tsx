"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, ListChecks, Pencil, Search, Clock3, CheckCircle2, ChevronRight, Download, TrendingUp, TriangleAlert, Network, Languages, Cpu, Terminal, Brain } from "lucide-react";
import { toast } from "sonner";
import { refreshOfflineSnapshotFromServer } from "@/lib/offline/sync";

type SessionItem = {
  id: string;
  cycleEntryId: string | null;
  subjectId: string | null;
  scope: "CYCLE" | "SUBJECT" | "GENERAL";
  date: string;
  questions: number;
  correct: number;
  wrong: number;
  percentage: number;
  estimatedMinutes: number;
  activityType: "QUESTIONS" | "CLASS" | "READING" | "PDF_READING" | "REVIEW";
  notes: string;
  subjectName: string;
  disciplineName: string;
};

type EntryItem = {
  id: string;
  subjectId: string | null;
  orderIndex: number;
  subjectName: string;
  disciplineName: string;
};
type SubjectItem = { id: string; name: string; disciplineName: string };

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

function timelineDate(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(dateIso));
}

function sessionIcon(name: string) {
  if (/rede|infraestrutura/i.test(name)) return <Network size={22} />;
  if (/portugu|inglês|língua/i.test(name)) return <Languages size={22} />;
  if (/lógic|raciocínio/i.test(name)) return <Brain size={22} />;
  if (/aplica|desenvolvimento|software|linguagen/i.test(name)) return <Terminal size={22} />;
  if (/plataforma|operaciona|hardware/i.test(name)) return <Cpu size={22} />;
  return <ListChecks size={22} />;
}

export function SessionManager({ sessions, cycleEntries, subjects }: { sessions: SessionItem[]; cycleEntries: EntryItem[]; subjects: SubjectItem[] }) {
  const router = useRouter();
  const [localSessions, setLocalSessions] = useState(sessions);
  const [query, setQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    scope: "SUBJECT" as SessionItem["scope"],
    cycleEntryId: cycleEntries[0]?.id ?? "",
    subjectId: cycleEntries[0]?.subjectId ?? null,
    date: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    questions: 0,
    correct: 0,
    estimatedMinutes: 60,
    activityType: "QUESTIONS" as SessionItem["activityType"],
    notes: "",
  });

  useEffect(() => {
    setLocalSessions(sessions);
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activitySessions = localSessions.filter(s => activityFilter === "all" || (activityFilter === "questions" ? s.activityType === "QUESTIONS" || s.activityType === "REVIEW" : s.activityType !== "QUESTIONS" && s.activityType !== "REVIEW"));
    if (!q) return activitySessions;
    return activitySessions.filter((session) =>
      [session.disciplineName, session.subjectName, formatPtBr(session.date), String(session.questions)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [localSessions, query, activityFilter]);

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function startEdit(item: SessionItem) {
    setEditingId(item.id);
    setForm({
      id: item.id,
      scope: item.scope,
      cycleEntryId: item.cycleEntryId ?? "",
      subjectId: item.subjectId,
      date: dayKeySaoPaulo(item.date),
      questions: item.questions,
      correct: item.correct,
      estimatedMinutes: item.estimatedMinutes,
      activityType: item.activityType,
      notes: item.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function deleteSession(id: string) {
    const confirmed = window.confirm("Excluir este registro de estudo? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    try {
      setDeletingId(id);
      const response = await fetch("/api/study-sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.message ?? "Erro ao excluir registro.");
        return;
      }

      setLocalSessions((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
      }
      toast.success("Registro excluído.");
      void refreshOfflineSnapshotFromServer().catch(() => undefined);
      router.refresh();
    } catch {
      toast.error("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveEdit() {
    if (!editingId) {
      toast.error("Selecione um registro para editar.");
      return;
    }

    const hasQuestionResults = form.activityType === "QUESTIONS" || form.scope === "GENERAL";
    if ((form.scope === "CYCLE" && !form.cycleEntryId) || (form.scope === "SUBJECT" && !form.subjectId) || form.estimatedMinutes <= 0 || (hasQuestionResults && (form.questions <= 0 || form.correct > form.questions))) {
      toast.error("Preencha os dados corretamente.");
      return;
    }

    try {
      setSaving(true);
      const questions = hasQuestionResults ? form.questions : 0;
      const correct = hasQuestionResults ? form.correct : 0;
      const wrong = Math.max(0, questions - correct);
      const response = await fetch("/api/study-sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.scope === "GENERAL" ? {
          scope: "GENERAL", id: form.id, date: form.date, questions, correct, wrong,
          estimatedMinutes: form.estimatedMinutes, notes: form.notes,
        } : {
          id: form.id, cycleEntryId: form.scope === "CYCLE" ? form.cycleEntryId : null, subjectId: form.subjectId ?? undefined, date: form.date, questions, correct, wrong,
          activityType: form.activityType, estimatedMinutes: form.estimatedMinutes, notes: form.notes,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.message ?? "Erro ao salvar alteração.");
        return;
      }

      const selectedEntry = cycleEntries.find((entry) => entry.id === form.cycleEntryId);
      const selectedSubject = subjects.find((subject) => subject.id === form.subjectId);
      const updatedDate = new Date(`${form.date}T12:00:00-03:00`).toISOString();
      const percentage = questions > 0 ? (correct / questions) * 100 : 0;

      setLocalSessions((current) =>
        [...current]
          .map((item) =>
            item.id === form.id
              ? {
                  ...item,
                  cycleEntryId: form.scope === "CYCLE" ? form.cycleEntryId : null,
                  subjectId: form.scope === "GENERAL" ? null : form.subjectId,
                  date: updatedDate,
                  questions,
                  correct,
                  wrong,
                  percentage,
                  activityType: form.scope === "GENERAL" ? "REVIEW" : form.activityType,
                  estimatedMinutes: form.estimatedMinutes,
                  notes: form.notes,
                  subjectName: form.scope === "GENERAL" ? "Revisão geral" : form.scope === "SUBJECT" ? selectedSubject?.name ?? item.subjectName : selectedEntry?.subjectId === form.subjectId ? selectedEntry.subjectName : item.subjectName,
                  disciplineName: form.scope === "GENERAL" ? "Todas as matérias" : form.scope === "SUBJECT" ? selectedSubject?.disciplineName ?? item.disciplineName : selectedEntry?.subjectId === form.subjectId ? selectedEntry.disciplineName : item.disciplineName,
                }
              : item,
          )
          .sort((a, b) => {
            const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
            return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
          }),
      );

      toast.success("Registro atualizado.");
      setEditingId(null);
      void refreshOfflineSnapshotFromServer().catch(() => undefined);
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {editingId ? (
        <div className="space-y-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Pencil size={14} /> Editando registro
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {form.scope === "GENERAL" ? <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary">Revisão geral</div> : <label className="text-xs font-semibold text-textSecondary">
              Atividade
              <select value={form.activityType} onChange={(event) => setForm((value) => ({ ...value, activityType: event.target.value as SessionItem["activityType"], questions: event.target.value === "QUESTIONS" ? value.questions : 0, correct: event.target.value === "QUESTIONS" ? value.correct : 0 }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"><option value="QUESTIONS">Questões</option><option value="CLASS">Videoaula</option><option value="READING">Lei seca</option><option value="PDF_READING">PDF/material</option><option value="REVIEW">Revisão</option></select>
            </label>}
            <label className="text-xs font-semibold text-textSecondary">
              Data
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((value) => ({ ...value, date: event.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"
              />
            </label>
            {form.scope === "CYCLE" ? <label className="text-xs font-semibold text-textSecondary xl:col-span-2">
              Assunto do ciclo
              <select
                value={form.cycleEntryId}
                onChange={(event) => setForm((value) => ({ ...value, cycleEntryId: event.target.value, subjectId: cycleEntries.find((entry) => entry.id === event.target.value)?.subjectId ?? null }))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"
              >
                {cycleEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    #{entry.orderIndex} - {entry.disciplineName} / {entry.subjectName}
                  </option>
                ))}
              </select>
            </label> : form.scope === "SUBJECT" ? <label className="text-xs font-semibold text-textSecondary xl:col-span-2">Assunto
              <select value={form.subjectId ?? ""} onChange={(event) => setForm((value) => ({ ...value, subjectId: event.target.value || null, cycleEntryId: "" }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated">
                <option value="">Selecione um assunto</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.disciplineName} / {subject.name}</option>)}
              </select>
            </label> : <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-textSecondary dark:text-textSecondary xl:col-span-2">Sem vínculo com matéria ou ciclo.</div>}
            {form.activityType === "QUESTIONS" || form.scope === "GENERAL" ? <label className="text-xs font-semibold text-textSecondary">
              Questões
              <input
                type="number"
                min={1}
                value={form.questions}
                onChange={(event) => setForm((value) => ({ ...value, questions: Number(event.target.value) || 0 }))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"
              />
            </label> : null}
            {form.activityType === "QUESTIONS" || form.scope === "GENERAL" ? <label className="text-xs font-semibold text-textSecondary">
              Acertos
              <input
                type="number"
                min={0}
                max={form.questions}
                value={form.correct}
                onChange={(event) => setForm((value) => ({ ...value, correct: Number(event.target.value) || 0 }))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"
              />
            </label> : null}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
            <label className="text-xs font-semibold text-textSecondary">
              Tempo (min)
              <input
                type="number"
                min={1}
                value={form.estimatedMinutes}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    estimatedMinutes: Number(event.target.value) || 0,
                  }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"
              />
            </label>
            <label className="text-xs font-semibold text-textSecondary">
              Observacoes
              <input
                value={form.notes}
                onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm dark:border-primary/30 dark:bg-elevated"
              />
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={!editingId || saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar alteração"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-textSecondary dark:border-primary/30 dark:text-textSecondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => editingId && deleteSession(editingId)}
              disabled={!editingId || deletingId === editingId}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {deletingId === editingId ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="history-filter sf-surface">
          <h2 className="sr-only">Todos os registros ({filtered.length})</h2>
          <label className="relative w-full md:w-80">
            <span className="sr-only">Filtrar registros por disciplina, assunto ou data</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Filtrar por disciplina/assunto/data"
              className="h-10 w-full rounded-lg border border-slate-300 bg-surface pl-9 pr-3 text-sm dark:border-primary/30 dark:bg-elevated"
            />
          </label><div className="history-tabs">{[['all','Todas as atividades'],['questions','Questões'],['theory','Teoria']].map(([id,label])=><button key={id} aria-pressed={activityFilter===id} onClick={()=>{setActivityFilter(id);setPage(1)}}>{label}</button>)}<a href="/simulados">Simulados</a></div>
        </div>

<div className="history-days">
          {[...new Set(pageItems.map((item) => dayKeySaoPaulo(item.date)))].map((day) => {
            const items = pageItems.filter((item) => dayKeySaoPaulo(item.date) === day);
            return <section key={day} aria-label={formatPtBr(items[0].date)}><div className="history-day-heading"><h3 className="flex items-center gap-2 text-base font-semibold"><span aria-hidden className="h-2 w-2 rounded-full bg-primary" />{timelineDate(items[0].date)}</h3><p className="text-[10px] font-medium uppercase tracking-wider text-textSecondary">{items.length} sessões · {items.reduce((sum, item) => sum + item.questions, 0)} questões · {items.reduce((sum, item) => sum + item.estimatedMinutes, 0)} min</p></div><div className="space-y-3">{items.map((item) => <article key={item.id} className="history-row" data-tone={item.questions > 0 && item.percentage < 70 ? "warning" : /rede|infraestrutura/i.test(item.disciplineName) ? "network" : "primary"}>
              <div className="history-identity"><span className="history-icon">{item.activityType === "QUESTIONS" ? sessionIcon(item.disciplineName) : <BookOpenCheck size={23}/>}</span><div><p><span>{item.activityType === "CLASS" ? "Videoaula" : item.activityType === "READING" ? "Lei seca" : item.activityType === "PDF_READING" ? "PDF/material" : item.activityType === "REVIEW" ? "Revisão" : "Questões"}</span> {item.disciplineName}</p><h4 title={item.subjectName}>{item.disciplineName} — {item.subjectName}</h4><p className="history-description">{item.notes || item.subjectName}</p></div></div>
              <div className="history-stats">{item.activityType === "QUESTIONS" || item.activityType === "REVIEW" || item.scope === "GENERAL" ? <><span><BookOpenCheck size={15}/>{item.questions} questões</span><div className="history-accuracy" data-low={item.percentage<70}>{item.percentage < 70 ? <TriangleAlert size={17}/> : <CheckCircle2 size={17}/>}<div>{item.correct} acertos<small>{item.percentage.toFixed(1)}% precisão</small></div><i><b style={{width:`${item.percentage}%`}}/></i></div></>:null}<span><Clock3 size={15}/>{item.estimatedMinutes>=60?`${Math.floor(item.estimatedMinutes/60)}h ${item.estimatedMinutes%60}m`:`${item.estimatedMinutes}m`}</span></div>
              <details className="history-details"><summary>Ver detalhes <ChevronRight size={14}/></summary><div><p>{item.subjectName}</p>{item.notes?<p>{item.notes}</p>:null}<button type="button" onClick={() => startEdit(item)}>Editar</button><button type="button" onClick={() => deleteSession(item.id)} disabled={deletingId === item.id}>{deletingId === item.id ? "Excluindo..." : "Excluir"}</button></div></details>            </article>)}</div></section>;
          })}
          {!pageItems.length ? <p className="sf-surface p-6 text-sm text-textSecondary">Nenhum registro encontrado.</p> : null}
        </div>
        <footer className="history-summary"><TrendingUp size={28}/><div><small>Métricas acumuladas</small><p>Total no período: {filtered.reduce((n,s)=>n+s.questions,0)} questões resolvidas · {(filtered.reduce((n,s)=>n+s.estimatedMinutes,0)/60).toFixed(1)}h líquidas estudadas · Média de acertos: {filtered.reduce((n,s)=>n+s.questions,0) ? (filtered.reduce((n,s)=>n+s.correct,0)/filtered.reduce((n,s)=>n+s.questions,0)*100).toFixed(1) : "0.0"}%</p></div><a href="/api/export/csv"><Download size={17}/> Exportar relatório</a></footer>
        {totalPages > 1 ? <div className="mt-4 flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="min-h-11 min-w-11 rounded-control px-3 text-xs font-bold text-textSecondary hover:bg-primary/10"
          >
            {"<"}
          </button>
          {Array.from({ length: totalPages })
            .slice(0, 8)
            .map((_, index) => {
              const targetPage = index + 1;
              const active = targetPage === currentPage;
              return (
                <button
                  key={targetPage}
                  type="button"
                  onClick={() => setPage(targetPage)}
                  className={`min-h-11 min-w-11 rounded-control px-3 text-xs font-bold ${
                    active ? "bg-primary text-white" : "text-textSecondary hover:bg-primary/10"
                  }`}
                >
                  {targetPage}
                </button>
              );
            })}
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="min-h-11 min-w-11 rounded-control px-3 text-xs font-bold text-textSecondary hover:bg-primary/10"
          >
            {">"}
          </button>
        </div> : null}
      </div>
    </div>
  );
}


