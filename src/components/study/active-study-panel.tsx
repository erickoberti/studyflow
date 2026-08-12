"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, Check, Clock3, FileText, Focus, ListChecks, Pause, Play, RotateCcw, Scale, Square, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  offlineSessionQueue,
  persistServerActiveSession,
  queueOfflineSessionOperation,
  startOfflineActiveSession,
  type OfflineActiveStudySession,
  type OfflineSessionOperationType,
} from "@/lib/offline/active-session-queue";
import { calculateElapsedSeconds } from "@/lib/study-timer";
import { STUDY_ACTIVITY_LABELS, type StudyActivity } from "@/lib/study-activity";

type Active = {
  id: string;
  mode: "CYCLE" | "AVULSO";
  status: "ACTIVE" | "PAUSED";
  version: number;
  startedAt: string;
  pausedAt: string | null;
  accumulatedSeconds: number;
  cycle: { entryId: string; position: number; round: number } | null;
  discipline: { id: string; name: string; questionGoal: number };
  subject: { id: string; name: string; weight: number; averagePercentage: number; lastStudiedAt: string | null };
};

type Suggestion = {
  entry: { id: string; orderIndex: number; discipline: { id: string; name: string; questionGoal: number } | null };
  subject: { id: string; name: string; weight: number } | null;
  roundNumber: number;
} | null;

type Summary = { todayMinutes: number; todayQuestions: number; dailyGoal: number; streak: number };
function duration(value: number) {
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function relativeDate(value: string | null) {
  if (!value) return "Ainda não estudado";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  return days <= 0 ? "Hoje" : days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}

async function command(body: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("/api/active-study-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(data.message ?? "Operação indisponível.");
    return data;
  }
  throw new TypeError("A operação ainda está sendo confirmada pelo servidor.");
}

function localToActive(session: OfflineActiveStudySession, source: Active | null, suggestion: Suggestion): Active {
  return {
    id: session.localSessionId,
    mode: session.mode,
    status: session.status === "PAUSED" ? "PAUSED" : "ACTIVE",
    version: session.serverVersion ?? source?.version ?? 1,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    accumulatedSeconds: session.accumulatedSeconds,
    cycle: session.mode === "CYCLE" ? {
      entryId: session.cycleEntryId ?? suggestion?.entry.id ?? "",
      position: source?.cycle?.position ?? suggestion?.entry.orderIndex ?? 1,
      round: source?.cycle?.round ?? suggestion?.roundNumber ?? 1,
    } : null,
    discipline: {
      id: session.disciplineId,
      name: session.disciplineName,
      questionGoal: source?.discipline.questionGoal ?? suggestion?.entry.discipline?.questionGoal ?? 20,
    },
    subject: {
      id: session.subjectId,
      name: session.subjectName,
      weight: source?.subject.weight ?? suggestion?.subject?.weight ?? 1,
      averagePercentage: source?.subject.averagePercentage ?? 0,
      lastStudiedAt: source?.subject.lastStudiedAt ?? null,
    },
  };
}

export function ActiveStudyPanel({
  userId,
  studyGuideId,
  initialActive,
  suggestion,
  nextSuggestion,
  defaultMinutes,
  preferredActivity = "QUESTIONS",
  summary,
}: {
  userId: string;
  studyGuideId: string;
  initialActive: Active | null;
  suggestion: Suggestion;
  nextSuggestion?: { discipline: string; subject: string } | null;
  defaultMinutes: number;
  preferredActivity?: StudyActivity;
  summary: Summary;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [seconds, setSeconds] = useState(() => initialActive ? calculateElapsedSeconds(initialActive) : 0);
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [studyActivity, setStudyActivity] = useState<StudyActivity>(preferredActivity);
  const [advanceCycle, setAdvanceCycle] = useState(true);
  const [studyMinutes, setStudyMinutes] = useState(defaultMinutes);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [difficulty, setDifficulty] = useState("Média");
  const [notes, setNotes] = useState("");
  const [completion, setCompletion] = useState<{ percentage: number; advanced: boolean; activityType: StudyActivity } | null>(null);

  const clearFinishForm = useCallback(() => {
    setStudyActivity(preferredActivity);
    setAdvanceCycle(true);
    setStudyMinutes(defaultMinutes);
    setCorrect(0);
    setWrong(0);
    setDifficulty("Média");
    setNotes("");
  }, [defaultMinutes, preferredActivity]);

  const openFinish = useCallback((session: Active, elapsed = calculateElapsedSeconds(session), activity?: StudyActivity) => {
    if (activity) setStudyActivity(activity);
    setStudyMinutes(elapsed > 0 ? Math.max(1, Math.round(elapsed / 60)) : defaultMinutes);
    setFinishOpen(true);
  }, [defaultMinutes]);

  useEffect(() => {
    setActive(initialActive);
    setSeconds(initialActive ? calculateElapsedSeconds(initialActive) : 0);
    clearFinishForm();
    if (initialActive) {
      persistServerActiveSession({ userId, studyGuideId, session: initialActive }).catch(() => undefined);
    } else if (!navigator.onLine) {
      offlineSessionQueue.getSession(userId, studyGuideId).then((local) => {
        if (local && (local.status === "ACTIVE" || local.status === "PAUSED")) {
          const restored = localToActive(local, null, suggestion);
          setActive(restored);
          setSeconds(calculateElapsedSeconds(restored));
          setCorrect(local.correct);
          setWrong(local.wrong);
          setDifficulty(local.difficulty ?? "Média");
          setNotes(local.notes ?? "");
        }
      }).catch(() => undefined);
    }
  }, [clearFinishForm, initialActive, studyGuideId, suggestion, userId]);

  useEffect(() => {
    if (!active) return;
    const update = () => setSeconds(calculateElapsedSeconds(active));
    update();
    if (active.status !== "ACTIVE") return;
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [active]);

  async function actOffline(body: Record<string, unknown>, shouldOpenFinish = false, activity?: StudyActivity) {
    const action = String(body.command);
    let local = await offlineSessionQueue.getSession(userId, studyGuideId);
    if (action === "start") {
      if (!suggestion?.entry.discipline || !suggestion.subject) throw new Error("A sugestão atual não está disponível offline.");
      const result = await startOfflineActiveSession({
        userId,
        studyGuideId,
        mode: "CYCLE",
        disciplineId: suggestion.entry.discipline.id,
        subjectId: suggestion.subject.id,
        cycleEntryId: suggestion.entry.id,
        disciplineName: suggestion.entry.discipline.name,
        subjectName: suggestion.subject.name,
        timerRunning: body.timerRunning !== false,
        operationId: typeof body.operationId === "string" ? body.operationId : undefined,
      });
      const restored = localToActive(result.session, null, suggestion);
      setActive(restored);
      setSeconds(0);
      if (shouldOpenFinish) openFinish(restored, 0, activity);
      toast.success(body.timerRunning === false ? "Registro pronto para preencher." : "Cronômetro iniciado e preservado neste dispositivo.");
      return;
    }
    if (!local) throw new Error("Nenhuma sessão ativa foi encontrada neste dispositivo.");
    const operationTypes: Record<string, OfflineSessionOperationType> = {
      pause: "PAUSE_SESSION",
      resume: "RESUME_SESSION",
      finish: "FINISH_SESSION",
      cancel: "CANCEL_SESSION",
    };
    const type = operationTypes[action];
    if (!type) throw new Error("Operação offline inválida.");
    if (type === "FINISH_SESSION") {
      const activityType = (body.activityType as StudyActivity | undefined) ?? (Number(body.questions ?? 0) === 0 ? "CLASS" : "QUESTIONS");
      local = {
        ...local,
        accumulatedSeconds: Number(body.minutes ?? 0) * 60,
        questions: Number(body.questions ?? 0),
        correct: Number(body.correct ?? 0),
        wrong: Number(body.questions ?? 0) - Number(body.correct ?? 0),
        difficulty: difficulty as "Fácil" | "Média" | "Difícil",
        activityType,
        advanceCycle,
        notes: notes.trim() || null,
      };
    }
    const queued = await queueOfflineSessionOperation({
      userId,
      studyGuideId,
      type,
      session: local,
      operationId: typeof body.operationId === "string" ? body.operationId : undefined,
    });
    if (type === "FINISH_SESSION") {
      setCompletion({ percentage: queued.session.questions ? queued.session.correct / queued.session.questions * 100 : -1, advanced: queued.session.advanceCycle !== false, activityType: queued.session.activityType ?? "QUESTIONS" });
      setFinishOpen(false);
      setFocusMode(false);
      setActive(null);
      clearFinishForm();
      toast.success("Sessão finalizada offline; o ciclo avançará uma vez após sincronizar.");
      return;
    }
    if (type === "CANCEL_SESSION") {
      setFocusMode(false);
      setActive(null);
      clearFinishForm();
      toast.success("Sessão cancelada localmente sem avançar o ciclo.");
      return;
    }
    const restored = localToActive(queued.session, active, suggestion);
    setActive(restored);
    setSeconds(calculateElapsedSeconds(restored));
  }

  async function act(body: Record<string, unknown>, options?: { openFinish?: boolean; activity?: StudyActivity }) {
    const operationBody = { ...body, operationId: crypto.randomUUID() };
    try {
      setBusy(true);
      const data = await command(operationBody);
      if (data.session) {
        if (data.session.id !== active?.id) clearFinishForm();
        setActive(data.session);
        const elapsed = calculateElapsedSeconds(data.session);
        setSeconds(elapsed);
        await persistServerActiveSession({ userId, studyGuideId, session: data.session });
        if (options?.openFinish) openFinish(data.session, elapsed, options.activity);
      } else if (data.sessionId) {
        setCompletion({ percentage: studyActivity === "QUESTIONS" ? questions ? correct / questions * 100 : 0 : -1, advanced: advanceCycle, activityType: studyActivity });
        toast.success(data.idempotent ? "Sessão já havia sido finalizada." : "Sessão concluída; ciclo atualizado.");
        setFinishOpen(false);
        setFocusMode(false);
        setActive(null);
        clearFinishForm();
        router.refresh();
      } else {
        setFocusMode(false);
        setActive(null);
        clearFinishForm();
        toast.success("Sessão cancelada sem alterar o ciclo.");
        router.refresh();
      }
    } catch (error) {
      if (!navigator.onLine || error instanceof TypeError) {
        try {
          await actOffline(operationBody, options?.openFinish, options?.activity);
        } catch (offlineError) {
          toast.error(offlineError instanceof Error ? offlineError.message : "Erro ao salvar offline.");
        }
      } else {
        toast.error(error instanceof Error ? error.message : "Erro na sessão.");
      }
    } finally {
      setBusy(false);
    }
  }

  const current = active ? {
    discipline: active.discipline.name,
    subject: active.subject.name,
    goal: active.discipline.questionGoal,
    position: active.cycle?.position,
    round: active.cycle?.round,
    weight: active.subject.weight,
    average: active.subject.averagePercentage,
    last: active.subject.lastStudiedAt,
  } : suggestion ? {
    discipline: suggestion.entry.discipline?.name ?? "Sem disciplina",
    subject: suggestion.subject?.name ?? "Sem assunto",
    goal: suggestion.entry.discipline?.questionGoal ?? 20,
    position: suggestion.entry.orderIndex,
    round: suggestion.roundNumber,
    weight: suggestion.subject?.weight ?? 1,
    average: 0,
    last: null,
  } : null;

  if (!current) return <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-white p-7 text-center dark:to-panelDark"><BookOpenCheck className="mx-auto text-primary" size={34} /><h2 className="mt-4 text-2xl font-black">Prepare seu primeiro estudo</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Adicione as disciplinas e escolha o ponto atual do ciclo. Depois disso, o StudyFlow sempre mostrará o próximo assunto automaticamente.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/base?import=1" className="rounded-xl bg-primary px-5 py-3 text-sm font-black text-white">Importar ou adicionar disciplinas</Link><Link href="/ciclo" className="rounded-xl border border-primary/25 px-5 py-3 text-sm font-black text-primary">Configurar ciclo</Link></div></section>;

  const studying = Boolean(active);
  const questions = correct + wrong;
  const percentage = questions ? correct / questions * 100 : 0;
  const isQuestions = studyActivity === "QUESTIONS";
  const validResults = !isQuestions || questions > 0;
  const validMinutes = Number.isInteger(studyMinutes) && studyMinutes > 0;
  const activityLabel = STUDY_ACTIVITY_LABELS[studyActivity];
  const timeLabel = studyActivity === "CLASS" ? "Tempo da videoaula (min)" : studyActivity === "READING" ? "Tempo de leitura da lei seca (min)" : studyActivity === "PDF_READING" ? "Tempo de leitura do PDF/material (min)" : "Tempo líquido estudado (min)";
  const goalProgress = Math.min(100, summary.dailyGoal ? summary.todayQuestions / summary.dailyGoal * 100 : 0);

  const panel = (
    <div className={`grid gap-5 ${focusMode ? "max-w-4xl" : "xl:grid-cols-[minmax(0,1fr)_310px]"}`}>
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-white p-6 shadow-soft dark:from-primary/15 dark:via-panelDark dark:to-panelDark sm:p-9">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                {studying ? active?.status === "PAUSED" ? "Registro em andamento" : "Cronômetro em andamento" : "Próximo estudo"} · volta {current.round ?? 1}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{current.discipline}</h2>
              <p className="mt-1 text-lg font-semibold text-slate-500 dark:text-slate-300">{current.subject}</p>
            </div>
            {active?.status === "ACTIVE" && !focusMode ? <button onClick={() => setFocusMode(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 bg-white/70 px-3 text-xs font-black text-primary dark:bg-slate-900/60"><Focus size={16} /> Modo foco</button> : null}
          </div>

          <div className="my-9 text-center">
            {studying ? <><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{active?.status === "ACTIVE" ? "Tempo decorrido" : "Tempo medido"}</p><p className="mt-3 text-6xl font-black tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-8xl">{duration(seconds)}</p></> : <><Clock3 className="mx-auto text-primary" size={38} /><p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Registre o tempo líquido ao finalizar</p><p className="mt-2 text-sm font-semibold text-slate-500">O cronômetro é opcional e poderá ser corrigido antes de salvar.</p></>}
            <p className="mt-3 text-sm font-semibold text-slate-500">Posição #{current.position ?? "avulsa"} · meta de {current.goal} questões</p>
          </div>

          {!studying ? (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button disabled={busy} onClick={() => act({ command: "start", mode: "CYCLE", timerRunning: false }, { openFinish: true, activity: "QUESTIONS" })} className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-black text-white shadow-lg shadow-primary/25 disabled:opacity-60"><ListChecks size={19} /> Registrar questões</button>
              <button disabled={busy} onClick={() => act({ command: "start", mode: "CYCLE", timerRunning: false }, { openFinish: true, activity: "CLASS" })} className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-primary/30 bg-white px-6 py-4 text-base font-black text-primary disabled:opacity-60 dark:bg-slate-900"><BookOpenCheck size={19} /> Registrar conteúdo</button>
              <button disabled={busy} onClick={() => act({ command: "start", mode: "CYCLE", timerRunning: true })} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-primary/30 bg-white px-5 py-3 font-black text-primary disabled:opacity-60 dark:bg-slate-900"><Play size={17} fill="currentColor" /> Iniciar cronômetro</button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {active?.status === "ACTIVE" ? <button disabled={busy} onClick={() => act({ command: "pause", id: active.id, version: active.version })} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-primary/30 bg-white px-5 py-3 font-black text-primary dark:bg-slate-900"><Pause size={17} /> Pausar</button> : <button disabled={busy} onClick={() => act({ command: "resume", id: active!.id, version: active!.version })} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-primary/30 bg-white px-5 py-3 font-black text-primary dark:bg-slate-900"><Play size={17} /> Iniciar cronômetro</button>}
              <button disabled={busy} onClick={() => active && openFinish(active, seconds)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white"><Check size={17} /> Finalizar e registrar</button>
              <button disabled={busy} onClick={() => window.confirm("Cancelar sem salvar ou avançar o ciclo?") && act({ command: "cancel", id: active!.id, version: active!.version })} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-3 font-bold text-rose-600"><X size={17} /> Cancelar</button>
            </div>
          )}
        </div>
      </section>

      {!focusMode ? <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Assunto atual</p><div className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><p className="text-slate-500">Média</p><p className="mt-1 text-xl font-black">{current.average.toFixed(0)}%</p></div><div><p className="text-slate-500">Peso</p><p className="mt-1 text-xl font-black">{current.weight}</p></div><div><p className="text-slate-500">Último estudo</p><p className="mt-1 font-bold">{relativeDate(current.last)}</p></div><div><p className="text-slate-500">Prioridade</p><p className="mt-1 font-bold text-primary">{current.average < 70 ? "Alta" : "Normal"}</p></div></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Hoje</p><div className="mt-3 flex items-center justify-between"><div><p className="text-2xl font-black">{summary.todayQuestions}<span className="text-sm text-slate-400">/{summary.dailyGoal}</span></p><p className="text-xs text-slate-500">questões · {Math.floor(summary.todayMinutes / 60)}h {summary.todayMinutes % 60}min</p></div><BarChart3 className="text-primary" /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: `${goalProgress}%` }} /></div><p className="mt-3 text-xs font-semibold text-slate-500">Sequência atual: {summary.streak} dias</p></article>
        {nextSuggestion ? <article className="rounded-2xl bg-slate-950 p-5 text-white dark:bg-primary/20"><p className="text-xs font-black uppercase tracking-wider text-white/55">Depois desta</p><p className="mt-2 font-black">{nextSuggestion.discipline}</p><p className="text-sm text-white/70">{nextSuggestion.subject}</p></article> : null}
      </aside> : null}
    </div>
  );

  return <>
    {focusMode ? <div className="fixed inset-0 z-[100] overflow-y-auto bg-backgroundLight p-4 dark:bg-backgroundDark sm:p-8"><button onClick={() => setFocusMode(false)} className="absolute right-5 top-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black dark:border-slate-700 dark:bg-slate-900"><RotateCcw size={16} /> Sair do foco</button>{panel}</div> : panel}

    {finishOpen && active ? <div role="dialog" aria-modal="true" aria-labelledby="finish-title" className="fixed inset-0 z-[110] flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-6"><section className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-panelDark sm:max-w-xl sm:rounded-3xl"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Finalizar sessão</p><h3 id="finish-title" className="mt-1 text-2xl font-black">Registre o que foi estudado</h3></div><button aria-label="Fechar" onClick={() => setFinishOpen(false)} className="rounded-lg p-2"><X /></button></div><p className="mt-2 text-sm text-slate-500">{current.discipline} · {current.subject}</p>

      <div className="mt-6"><p className="text-sm font-bold">O que você estudou?</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" aria-pressed={studyActivity === "QUESTIONS"} onClick={() => setStudyActivity("QUESTIONS")} className={`inline-flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "QUESTIONS" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><ListChecks size={20} /> Questões</button>
        <button type="button" aria-pressed={studyActivity === "CLASS"} onClick={() => { setStudyActivity("CLASS"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "CLASS" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><Video size={20} /> Videoaula</button>
        <button type="button" aria-pressed={studyActivity === "READING"} onClick={() => { setStudyActivity("READING"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "READING" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><Scale size={20} /> Lei seca</button>
        <button type="button" aria-pressed={studyActivity === "PDF_READING"} onClick={() => { setStudyActivity("PDF_READING"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "PDF_READING" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><FileText size={20} /> PDF/material</button>
      </div></div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold sm:col-span-2">{timeLabel}<span className="relative mt-1.5 block"><Clock3 aria-hidden size={16} className="absolute left-3 top-4 text-slate-400" /><input aria-label={`${timeLabel.replace(" (min)", "")} em minutos`} inputMode="numeric" type="number" min={1} step={1} value={studyMinutes} onChange={(event) => setStudyMinutes(Math.max(0, Number(event.target.value) || 0))} className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-lg font-black dark:border-slate-700 dark:bg-slate-900" /></span><span className="mt-1 block text-xs font-normal text-slate-500">{seconds > 0 ? `Cronômetro: ${duration(seconds)}. Você pode corrigir o valor acima.` : `Informe o tempo real dedicado a ${activityLabel.toLocaleLowerCase("pt-BR")}.`}</span></label>
        {isQuestions ? <><label className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Acertos<input aria-label="Acertos" inputMode="numeric" type="number" min={0} value={correct} onChange={(event) => setCorrect(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg font-black dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-bold text-rose-700 dark:text-rose-300">Erros<input aria-label="Erros" inputMode="numeric" type="number" min={0} value={wrong} onChange={(event) => setWrong(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg font-black dark:border-slate-700 dark:bg-slate-900" /></label></> : <div className="sm:col-span-2 rounded-xl bg-primary/5 p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{activityLabel} contará como uma sessão, somará o tempo informado e poderá concluir esta posição do ciclo.</div>}
      </div>

      {isQuestions ? <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-800"><div className="flex justify-between"><span>Total de questões</span><b>{questions}</b></div><div className="mt-2 flex justify-between"><span>Percentual de acertos</span><b>{questions ? `${percentage.toFixed(0)}%` : "—"}</b></div></div> : null}
      {!validMinutes ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">Informe ao menos 1 minuto de estudo.</p> : null}
      {!validResults ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">Informe ao menos um acerto ou erro.</p> : null}

      <div className="mt-4"><p className="text-sm font-bold">Dificuldade</p><div className="mt-2 grid grid-cols-3 gap-2">{([['Fácil', '🙂'], ['Média', '😐'], ['Difícil', '😓']] as const).map(([value, icon]) => <button key={value} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)} className={`min-h-16 rounded-xl border px-2 text-sm font-bold ${difficulty === value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}><span aria-hidden className="block text-xl">{icon}</span>{value}</button>)}</div></div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><input type="checkbox" checked={advanceCycle} onChange={(event) => setAdvanceCycle(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span><span className="block text-sm font-black">Avançar para a próxima posição</span><span className="mt-0.5 block text-xs text-slate-500">Desmarque se ainda vai continuar neste mesmo assunto.</span></span></label>
      <label className="mt-4 block text-sm font-bold">Observação <span className="font-normal text-slate-400">(opcional)</span><textarea aria-label="Observação" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" placeholder="O que revisar ou lembrar na próxima sessão?" /></label>
      <button disabled={busy || !validMinutes || !validResults} onClick={() => act({ command: "finish", id: active.id, version: active.version, questions: isQuestions ? questions : 0, correct: isQuestions ? correct : 0, minutes: studyMinutes, activityType: studyActivity, advanceCycle, notes: `[${difficulty}] ${notes.trim()}`.trim() })} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-50"><Square size={17} /> {advanceCycle ? isQuestions ? "Salvar e concluir" : `Salvar ${activityLabel.toLocaleLowerCase("pt-BR")} e avançar` : "Salvar e continuar no assunto"}</button>
    </section></div> : null}

    {completion ? <div role="status" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-5"><section className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl dark:bg-panelDark"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><Check size={28} /></span><h3 className="mt-4 text-2xl font-black">Registro concluído</h3><p className="mt-1 text-sm font-bold text-primary">{STUDY_ACTIVITY_LABELS[completion.activityType]}</p><p className="mt-2 text-sm text-slate-500">{completion.percentage < 0 ? completion.advanced ? "O tempo informado foi somado e o ciclo avançou para a próxima posição." : "O tempo informado foi somado e este assunto continuará como a próxima atividade." : `Aproveitamento de ${completion.percentage.toFixed(0)}%. ${completion.advanced ? "O ciclo avançou." : "Você continuará neste assunto."}`}</p><button onClick={() => setCompletion(null)} className="mt-6 min-h-11 w-full rounded-xl bg-primary px-5 font-black text-white">Continuar</button></section></div> : null}
  </>;
}
