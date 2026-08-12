"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, ListChecks, Scale, Video } from "lucide-react";
import { toast } from "sonner";
import { getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { getOfflineNextSuggestion } from "@/lib/offline/analytics";
import { getActiveOfflineGuide } from "@/lib/offline/selectors";
import { createStandaloneOfflineSession, queueOfflineSessionOperation, startOfflineActiveSession, type OfflineDifficulty, type OfflineStudyMode } from "@/lib/offline/active-session-queue";
import { STUDY_ACTIVITY_LABELS, type StudyActivity } from "@/lib/study-activity";

function dayKey(date: Date) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function timeKey(date: Date) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date); }

export function OfflineSessionForm() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const [mode, setMode] = useState<OfflineStudyMode>("CYCLE");
  const [activityType, setActivityType] = useState<StudyActivity>("QUESTIONS");
  const [advanceCycle, setAdvanceCycle] = useState(true);
  const [disciplineId, setDisciplineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [time, setTime] = useState(timeKey(new Date()));
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
  useEffect(() => { if (disciplineId && !disciplines.some((item) => item.id === disciplineId)) { setDisciplineId(""); setSubjectId(""); } }, [disciplineId, disciplines]);
  useEffect(() => { if (subjectId && !subjects.some((item) => item.id === subjectId)) setSubjectId(""); }, [subjectId, subjects]);

  async function submit() {
    const userId = snapshot.user?.id; const studyGuideId = guide?.serverId ?? guide?.id;
    if (!userId || !studyGuideId) return toast.error("Sincronize o guia neste dispositivo antes de registrar offline.");
    if (activityType === "QUESTIONS" && correct + wrong <= 0) return toast.error("Informe ao menos um acerto ou erro.");
    setBusy(true);
    try {
      if (mode === "AVULSO") {
        const discipline = disciplines.find((item) => item.id === disciplineId); const subject = subjects.find((item) => item.id === subjectId);
        if (!discipline?.serverId || !subject?.serverId) throw new Error("Escolha uma disciplina e um assunto já sincronizados.");
        const sessionDate = new Date(`${date}T${time}:00-03:00`);
        if (Number.isNaN(sessionDate.getTime()) || sessionDate.getTime() > Date.now() + 60_000) throw new Error("Informe uma data e um horário válidos, sem usar o futuro.");
        await createStandaloneOfflineSession({ userId, studyGuideId, mode: "AVULSO", disciplineId: discipline.serverId, subjectId: subject.serverId, cycleEntryId: null, disciplineName: discipline.name, subjectName: subject.name, startedAt: sessionDate.toISOString(), pausedAt: null, finishedAt: new Date().toISOString(), accumulatedSeconds: minutes * 60, questions: activityType === "QUESTIONS" ? correct + wrong : 0, correct: activityType === "QUESTIONS" ? correct : 0, wrong: activityType === "QUESTIONS" ? wrong : 0, activityType, advanceCycle: false, difficulty, notes: notes.trim() || null, date: sessionDate.toISOString() });
      } else {
        const entry = suggestion; const discipline = entry?.subject.discipline; const subject = entry?.subject;
        if (!entry?.serverId || !discipline?.serverId || !subject?.serverId) throw new Error("A sugestão atual precisa estar sincronizada antes do uso offline.");
        const started = await startOfflineActiveSession({ userId, studyGuideId, mode: "CYCLE", disciplineId: discipline.serverId, subjectId: subject.serverId, cycleEntryId: entry.serverId, disciplineName: discipline.name, subjectName: subject.name, timerRunning: false });
        await queueOfflineSessionOperation({ userId, studyGuideId, type: "FINISH_SESSION", session: { ...started.session, accumulatedSeconds: minutes * 60, questions: activityType === "QUESTIONS" ? correct + wrong : 0, correct: activityType === "QUESTIONS" ? correct : 0, wrong: activityType === "QUESTIONS" ? wrong : 0, activityType, advanceCycle, difficulty, notes: notes.trim() || null, date: new Date(`${date}T12:00:00-03:00`).toISOString() } });
      }
      toast.success(mode === "CYCLE" ? advanceCycle ? "Sessão salva. O ciclo avançará após sincronizar." : "Sessão salva; você continuará no mesmo assunto." : "Estudo avulso salvo para sincronização.");
      const now = new Date(); setCorrect(0); setWrong(0); setActivityType("QUESTIONS"); setAdvanceCycle(true); setNotes(""); setDifficulty("Média"); setMinutes(60); setDate(dayKey(now)); setTime(timeKey(now)); setDisciplineId(""); setSubjectId("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a sessão."); }
    finally { setBusy(false); }
  }

  const total = correct + wrong;
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Registro offline</p><h2 className="mt-2 text-3xl font-black">Salvar sessão local</h2>
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">{(["CYCLE", "AVULSO"] as const).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`min-h-11 rounded-xl text-sm font-black ${mode === value ? "bg-white text-primary shadow dark:bg-slate-800" : "text-slate-500"}`}>{value === "CYCLE" ? "Modo ciclo" : "Estudo avulso"}</button>)}</div>
      <div className="mt-4"><p className="text-sm font-bold">O que você estudou?</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><button type="button" onClick={() => setActivityType("QUESTIONS")} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-black ${activityType === "QUESTIONS" ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}><ListChecks size={18} /> Questões</button><button type="button" onClick={() => { setActivityType("CLASS"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-black ${activityType === "CLASS" ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}><Video size={18} /> Videoaula</button><button type="button" onClick={() => { setActivityType("READING"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-black ${activityType === "READING" ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}><Scale size={18} /> Lei seca</button><button type="button" onClick={() => { setActivityType("PDF_READING"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-black ${activityType === "PDF_READING" ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}><FileText size={18} /> PDF/material</button></div></div>
      {mode === "CYCLE" ? <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-black uppercase text-primary">Posição atual</p><p className="mt-2 font-black">{suggestion?.subject.discipline.name ?? "Sem sugestão disponível"}</p><p className="text-sm text-slate-500">{suggestion?.subject.name ?? "Conecte-se para atualizar o ciclo."}</p></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Disciplina<select aria-label="Disciplina" value={disciplineId} onChange={(event) => { setDisciplineId(event.target.value); setSubjectId(""); }} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="">Selecione uma disciplina</option>{disciplines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-bold">Assunto<select aria-label="Assunto" disabled={!disciplineId || subjects.length === 0} value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"><option value="">{disciplineId ? subjects.length ? "Selecione um assunto" : "Nenhum assunto ativo" : "Escolha uma disciplina primeiro"}</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">Data<input type="date" max={dayKey(new Date())} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label>{mode === "AVULSO" ? <label className="text-sm font-bold">Horário<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label> : null}{activityType === "QUESTIONS" ? <><label className="text-sm font-bold">Acertos<input type="number" min={0} value={correct} onChange={(event) => setCorrect(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-bold">Erros<input type="number" min={0} value={wrong} onChange={(event) => setWrong(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label></> : null}<label className="text-sm font-bold">Tempo (min)<input type="number" min={1} value={minutes} onChange={(event) => setMinutes(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 h-12 w-full rounded-xl border bg-white px-3 dark:border-slate-700 dark:bg-slate-900" /></label></div>
      {mode === "CYCLE" ? <label className="mt-4 flex items-start gap-3 rounded-xl border p-4 dark:border-slate-700"><input type="checkbox" checked={advanceCycle} onChange={(event) => setAdvanceCycle(event.target.checked)} className="mt-1 accent-primary" /><span><b className="block text-sm">Avançar no ciclo ao sincronizar</b><span className="text-xs text-slate-500">Desmarque para continuar no mesmo assunto.</span></span></label> : null}
      <div className="mt-4"><p className="text-sm font-bold">Dificuldade</p><div className="mt-2 grid grid-cols-3 gap-2">{(["Fácil", "Média", "Difícil"] as const).map((value) => <button key={value} type="button" onClick={() => setDifficulty(value)} className={`min-h-11 rounded-xl border text-sm font-bold ${difficulty === value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}>{value}</button>)}</div></div>
      <label className="mt-4 block text-sm font-bold">Observação<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="O que revisar ou lembrar na próxima sessão?" className="mt-1.5 w-full rounded-xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900" /></label>
      {activityType === "QUESTIONS" ? <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">Total: <b>{total}</b> · Aproveitamento: <b>{total ? Math.round(correct / total * 100) : 0}%</b></div> : <div className="mt-4 rounded-xl bg-primary/5 p-3 text-sm font-semibold">{STUDY_ACTIVITY_LABELS[activityType]} contará o tempo e a sessão normalmente.</div>}
      <button type="button" disabled={busy || (activityType === "QUESTIONS" && total === 0)} onClick={submit} className="mt-5 min-h-12 rounded-xl bg-primary px-5 font-black text-white disabled:opacity-50">{busy ? "Salvando..." : `Salvar ${STUDY_ACTIVITY_LABELS[activityType].toLocaleLowerCase("pt-BR")} localmente`}</button>
    </article>
    <aside className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-sm text-white/70">Fila confiável</p><p className="mt-3 text-sm text-white/80">Cada ação recebe um identificador único e permanece no IndexedDB após refresh ou fechamento do navegador.</p><p className="mt-4 text-xs text-white/60">O cursor do ciclo não é alterado neste dispositivo. O servidor avança uma única vez ao confirmar a finalização.</p></aside>
  </div>;
}
