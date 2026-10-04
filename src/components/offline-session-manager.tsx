"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteOfflineSession, getOfflineSnapshot, subscribeOfflineStore, updateOfflineSession } from "@/lib/offline/store";
import { expandOfflineEntry, getActiveOfflineGuide, getDisciplineMap, getOfflineCycleEntries, getSubjectMap } from "@/lib/offline/selectors";

function formatPtBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateIso));
}

function dayKeySaoPaulo(dateIso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateIso));
}

export function OfflineSessionManager() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    scope: "SUBJECT" as "CYCLE" | "SUBJECT" | "GENERAL",
    cycleEntryId: "",
    subjectId: "",
    date: dayKeySaoPaulo(new Date().toISOString()),
    questions: 0,
    correct: 0,
    estimatedMinutes: 60,
    activityType: "QUESTIONS" as "QUESTIONS" | "CLASS" | "READING" | "PDF_READING" | "REVIEW",
    notes: "",
  });

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);

  const activeGuide = getActiveOfflineGuide(snapshot);
  const subjectMap = getSubjectMap(snapshot);
  const disciplineMap = getDisciplineMap(snapshot);
  const availableEntries = useMemo(
    () =>
      getOfflineCycleEntries(snapshot, activeGuide?.id)
        .filter((entry) => Boolean(entry.serverId))
        .map((entry) => expandOfflineEntry(entry, subjectMap, disciplineMap))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [activeGuide?.id, disciplineMap, snapshot, subjectMap],
  );
  const availableSubjects = useMemo(
    () => snapshot.subjects.filter((subject) => subject.guideId === activeGuide?.id && subject.active && subject.serverId),
    [activeGuide?.id, snapshot.subjects],
  );

  const sessions = useMemo(
    () => snapshot.sessions.filter((session) => session.syncStatus !== "pending_delete"),
    [snapshot.sessions],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => {
      const entry = availableEntries.find((item) => item.id === session.cycleEntryId);
      const subject = subjectMap.get(session.subjectId ?? entry?.subject.id ?? "");
      return [
        formatPtBr(session.date),
        session.scope === "GENERAL" ? "todas as matérias" : subject ? disciplineMap.get(subject.disciplineId)?.name ?? "" : "",
        session.scope === "GENERAL" ? "revisão geral" : subject?.name ?? "",
        session.syncStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [availableEntries, disciplineMap, query, sessions, subjectMap]);

  function startEdit(id: string) {
    const session = snapshot.sessions.find((item) => item.id === id);
    if (!session) return;
    setEditingId(id);
    setForm({
      scope: session.scope ?? "SUBJECT",
      cycleEntryId: session.cycleEntryId ?? "",
      subjectId: session.subjectId ?? availableEntries.find((entry) => entry.id === session.cycleEntryId)?.subject.id ?? "",
      date: dayKeySaoPaulo(session.date),
      questions: session.questions,
      correct: session.correct,
      estimatedMinutes: session.estimatedMinutes,
      activityType: session.activityType ?? "QUESTIONS",
      notes: session.notes ?? "",
    });
  }

  function save() {
    if (!editingId) return;
    const hasQuestions = form.activityType === "QUESTIONS" || form.scope === "GENERAL";
    if ((form.scope === "CYCLE" && !form.cycleEntryId) || (form.scope === "SUBJECT" && !form.subjectId) || form.estimatedMinutes <= 0 || (hasQuestions && (form.questions <= 0 || form.correct > form.questions))) {
      toast.error("Preencha os dados corretamente.");
      return;
    }

    updateOfflineSession(editingId, {
      cycleEntryId: form.scope === "CYCLE" ? form.cycleEntryId : null,
      subjectId: form.scope === "GENERAL" ? null : form.subjectId,
      scope: form.scope,
      date: form.date,
      questions: hasQuestions ? form.questions : 0,
      correct: hasQuestions ? form.correct : 0,
      wrong: hasQuestions ? Math.max(0, form.questions - form.correct) : 0,
      estimatedMinutes: form.estimatedMinutes,
      activityType: form.scope === "GENERAL" ? "REVIEW" : form.activityType,
      notes: form.notes.trim() || null,
    });

    toast.success("Registro atualizado localmente.");
    setEditingId(null);
  }

  function remove(id: string) {
    deleteOfflineSession(id);
    if (editingId === id) {
      setEditingId(null);
    }
    toast.success("Registro removido da base local.");
  }

  return (
    <div className="space-y-5 pb-10">
      {editingId ? (
        <section className="rounded-3xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-slate-950/70">
          <h2 className="text-lg font-semibold">Editar registro local</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {form.scope === "GENERAL" ? <div className="rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">Revisão geral</div> : <label className="text-sm font-semibold">Atividade<select value={form.activityType} onChange={(event) => setForm((current) => ({ ...current, activityType: event.target.value as typeof current.activityType }))} className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"><option value="QUESTIONS">Questões</option><option value="CLASS">Videoaula</option><option value="READING">Lei seca</option><option value="PDF_READING">PDF/material</option><option value="REVIEW">Revisão</option></select></label>}
            <label className="text-sm font-semibold">
              Data
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"
              />
            </label>
            {form.scope === "SUBJECT" ? <label className="text-sm font-semibold">
              Assunto
              <select value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))} className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated">
                <option value="">Selecione um assunto</option>
                {availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{disciplineMap.get(subject.disciplineId)?.name ?? "Disciplina"} / {subject.name}</option>)}
              </select>
            </label> : form.scope === "CYCLE" ? <label className="text-sm font-semibold">
              Assunto
              <select
                value={form.cycleEntryId}
                onChange={(event) => setForm((current) => ({ ...current, cycleEntryId: event.target.value, subjectId: availableEntries.find((entry) => entry.id === event.target.value)?.subject.id ?? "" }))}
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"
              >
                {availableEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    #{entry.orderIndex} - {entry.subject.discipline.name} / {entry.subject.name}
                  </option>
                ))}
              </select>
            </label> : null}
            <label className="text-sm font-semibold">
              Questões
              <input
                type="number"
                value={form.questions}
                onChange={(event) => setForm((current) => ({ ...current, questions: Number(event.target.value) || 0 }))}
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"
              />
            </label>
            <label className="text-sm font-semibold">
              Acertos
              <input
                type="number"
                value={form.correct}
                onChange={(event) => setForm((current) => ({ ...current, correct: Number(event.target.value) || 0 }))}
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"
              />
            </label>
            <label className="text-sm font-semibold">
              Tempo (min)
              <input
                type="number"
                value={form.estimatedMinutes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, estimatedMinutes: Number(event.target.value) || 0 }))
                }
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"
              />
            </label>
            <label className="text-sm font-semibold">
              Notas
              <input
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-300 bg-surface px-3 dark:border-white/10 dark:bg-elevated"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
              Salvar
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-white/5 dark:bg-slate-950/70">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-semibold">Sessões locais</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar por disciplina, assunto ou status"
            className="h-11 w-full rounded-full border border-slate-300 bg-surface px-4 text-sm md:w-80 dark:border-white/10 dark:bg-elevated"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase text-textSecondary">
              <tr>
                <th className="py-2">Data</th>
                <th className="py-2">Disciplina</th>
                <th className="py-2">Assunto</th>
                <th className="py-2">Atividade</th>
                <th className="py-2 text-right">Questões</th>
                <th className="py-2 text-right">% </th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((session) => {
                const entry = availableEntries.find((item) => item.id === session.cycleEntryId);
                const subject = subjectMap.get(session.subjectId ?? entry?.subject.id ?? "");
                return (
                  <tr key={session.id}>
                    <td className="py-3">{formatPtBr(session.date)}</td>
                    <td className="py-3 font-medium">{session.scope === "GENERAL" ? "Todas as matérias" : subject ? disciplineMap.get(subject.disciplineId)?.name ?? "-" : "-"}</td>
                    <td className="py-3">{session.scope === "GENERAL" ? "Revisão geral" : subject?.name ?? "-"}</td>
                    <td className="py-3 font-semibold text-primary">{session.activityType === "CLASS" ? "Videoaula" : session.activityType === "READING" ? "Lei seca" : session.activityType === "PDF_READING" ? "PDF/material" : session.activityType === "REVIEW" ? "Revisão" : "Questões"}</td>
                    <td className="py-3 text-right">{session.activityType && session.activityType !== "QUESTIONS" && session.scope !== "GENERAL" ? "—" : session.questions}</td>
                    <td className="py-3 text-right">{session.activityType && session.activityType !== "QUESTIONS" && session.scope !== "GENERAL" ? `${session.estimatedMinutes} min` : `${session.percentage.toFixed(1)}%`}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase text-slate-700 dark:bg-elevated dark:text-slate-200">
                        {session.syncStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(session.id)}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(session.id)}
                        className="ml-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
