"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { getOfflineNextSuggestion } from "@/lib/offline/analytics";
import { getActiveOfflineGuide } from "@/lib/offline/selectors";
import { createStandaloneOfflineSession, queueOfflineSessionOperation, startOfflineActiveSession, type OfflineDifficulty, type OfflineStudyMode } from "@/lib/offline/active-session-queue";

function dayKey(date: Date) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }

export function OfflineSessionForm() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const [mode, setMode] = useState<OfflineStudyMode>("CYCLE");
  const [disciplineId, setDisciplineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [minutes, setMinutes] = useState(60);
  const [difficulty, setDifficulty] = useState<OfflineDifficulty>("Média");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const guide = getActiveOfflineGuide(snapshot);
  const suggestion = getOfflineNextSuggestion(snapshot).next;
  const disciplines = useMemo(() => snapshot.disciplines.filter((item) => item.guideId === guide?.id && item.active), [snapshot, guide?.id]);
  const subjects = useMemo(() => snapshot.subjects.filter((item) => item.guideId === guide?.id && item.disciplineId === disciplineId && item.active), [snapshot, guide?.id, disciplineId]);

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);
  useEffect(() => { if (!disciplineId && disciplines[0]) setDisciplineId(disciplines[0].id); }, [disciplineId, disciplines]);
  useEffect(() => { if (!subjects.some((item) => item.id === subjectId)) setSubjectId(subjects[0]?.id ?? ""); }, [subjectId, subjects]);

  async function submit() {
    const userId = snapshot.user?.id; const studyGuideId = guide?.serverId ?? guide?.id;
    if (!userId || !studyGuideId) return toast.error("Sincronize o guia neste dispositivo antes de registrar offline.");
    if (correct + wrong <= 0) return toast.error("Informe ao menos um acerto ou erro.");
    setBusy(true);
    try {
      if (mode === "AVULSO") {
        const discipline = disciplines.find((item) => item.id === disciplineId); const subject = subjects.find((item) => item.id === subjectId);
        if (!discipline?.serverId || !subject?.serverId) throw new Error("Escolha uma disciplina e um assunto já sincronizados.");
        await createStandaloneOfflineSession({ userId, studyGuideId, mode: "AVULSO", disciplineId: discipline.serverId, subjectId: subject.serverId, cycleEntryId: null, disciplineName: discipline.name, subjectName: subject.name, startedAt: new Date(`${date}T12:00:00-03:00`).toISOString(), pausedAt: null, finishedAt: new Date().toISOString(), accumulatedSeconds: minutes * 60, questions: correct + wrong, correct, wrong, difficulty, notes: notes.trim() || null, date: new Date(`${date}T12:00:00-03:00`).toISOString() });
      } else {
        const entry = suggestion; const discipline = entry?.subject.discipline; const subject = entry?.subject;
        if (!entry?.serverId || !discipline?.serverId || !subject?.serverId) throw new Error("A sugestão atual precisa estar sincronizada antes do uso offline.");
        const started = await startOfflineActiveSession({ userId, studyGuideId, mode: "CYCLE", disciplineId: discipline.serverId, subjectId: subject.serverId, cycleEntryId: entry.serverId, disciplineName: discipline.name, subjectName: subject.name });
        await queueOfflineSessionOperation({ userId, studyGuideId, type: "FINISH_SESSION", session: { ...started.session, accumulatedSeconds: minutes * 60, questions: correct + wrong, correct, wrong, difficulty, notes: notes.trim() || null, date: new Date(`${date}T12:00:00-03:00`).toISOString() } });
      }
      toast.success("Sessão salva na fila offline. O ciclo avançará somente após a sincronização.");
      setCorrect(0); setWrong(0); setNotes("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a sessão."); }
    finally { setBusy(false); }
  }

  const total = correct + wrong;
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Registro offline</p><h2 className="mt-2 text-3xl font-black">Salvar sessão local</h2>
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">{(["CYCLE", "AVULSO"] as const).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`min-h-11 rounded-xl text-sm font-black ${mode === value ? "bg-white text-primary shadow dark:bg-slate-800" : "text-slate-500"}`}>{value === "CYCLE" ? "Modo ciclo" : "Estudo avulso"}</button>)}</div>
      {mode === "CYCLE" ? <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-black uppercase text-primary">Posição atual</p><p className="mt-2 font-black">{suggestion?.subject.discipline.name ?? "Sem sugestão disponível"}</p><p className="text-sm text-slate-500">{suggestion?.subject.name ?? "Conecte-se para atualizar o ciclo."}</p></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Disciplina<select value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900">{disciplines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-bold">Assunto<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900">{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-bold">Acertos<input type="number" min={0} value={correct} onChange={(event) => setCorrect(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-bold">Erros<input type="number" min={0} value={wrong} onChange={(event) => setWrong(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-bold">Tempo (min)<input type="number" min={1} value={minutes} onChange={(event) => setMinutes(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label></div>
      <div className="mt-4"><p className="text-sm font-bold">Dificuldade</p><div className="mt-2 grid grid-cols-3 gap-2">{(["Fácil", "Média", "Difícil"] as const).map((value) => <button key={value} type="button" onClick={() => setDifficulty(value)} className={`min-h-11 rounded-xl border text-sm font-bold ${difficulty === value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}>{value}</button>)}</div></div>
      <label className="mt-4 block text-sm font-bold">Observação<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="O que revisar ou lembrar na próxima sessão?" className="mt-1.5 w-full rounded-xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
      <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">Total: <b>{total}</b> · Aproveitamento: <b>{total ? Math.round(correct / total * 100) : 0}%</b></div>
      <button type="button" disabled={busy || total === 0} onClick={submit} className="mt-5 min-h-12 rounded-xl bg-primary px-5 font-black text-white disabled:opacity-50">{busy ? "Salvando..." : "Salvar localmente"}</button>
    </article>
    <aside className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-sm text-white/70">Fila confiável</p><p className="mt-3 text-sm text-white/80">Cada ação recebe um identificador único e permanece no IndexedDB após refresh ou fechamento do navegador.</p><p className="mt-4 text-xs text-white/60">O cursor do ciclo não é alterado neste dispositivo. O servidor avança uma única vez ao confirmar a finalização.</p></aside>
  </div>;
}
