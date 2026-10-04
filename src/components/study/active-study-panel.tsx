"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Check, Clock3, FileText, Focus, ListChecks, Pause, Play, RotateCcw, Scale, Square, Video, X } from "lucide-react";
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
      id: session.disciplineId ?? "",
      name: session.disciplineName,
      questionGoal: source?.discipline.questionGoal ?? suggestion?.entry.discipline?.questionGoal ?? 20,
    },
    subject: {
      id: session.subjectId ?? "",
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
  showStandaloneLink = true,
  summary,
  referencePresentation,
  initialVisualMode,
}: {
  userId: string;
  studyGuideId: string;
  initialActive: Active | null;
  suggestion: Suggestion;
  nextSuggestion?: { discipline: string; subject: string; position?: number } | null;
  defaultMinutes: number;
  preferredActivity?: StudyActivity;
  showStandaloneLink?: boolean;
  summary: Summary;
  referencePresentation?: { positions: number; average: number; lastStudiedAt: string | null };
  initialVisualMode?: "TIMER" | "QUESTIONS";
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [seconds, setSeconds] = useState(initialActive?.accumulatedSeconds ?? 0);
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [visualMode, setVisualMode] = useState<"QUESTIONS" | "CONTENT" | "TIMER">(initialActive ? "TIMER" : initialVisualMode ?? (preferredActivity === "QUESTIONS" ? "QUESTIONS" : "CONTENT"));
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
    average: referencePresentation?.average ?? 0,
    last: referencePresentation?.lastStudiedAt ?? null,
  } : null;

  if (!current) return <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-white p-7 text-center dark:to-panelDark"><BookOpenCheck className="mx-auto text-primary" size={34} /><h2 className="mt-4 text-2xl font-semibold">Prepare seu primeiro estudo</h2><p className="mx-auto mt-2 max-w-lg text-sm text-textSecondary">Adicione as disciplinas e escolha o ponto atual do ciclo. Depois disso, o StudyFlow sempre mostrará o próximo assunto automaticamente.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/base?import=1" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Importar ou adicionar disciplinas</Link><Link href="/ciclo" className="rounded-xl border border-primary/25 px-5 py-3 text-sm font-semibold text-primary">Configurar ciclo</Link>{showStandaloneLink ? <Link href="/registro?novo=1" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary dark:text-primary">Registrar estudo avulso</Link> : null}</div></section>;

  const studying = Boolean(active);
  const questions = correct + wrong;
  const percentage = questions ? correct / questions * 100 : 0;
  const isQuestions = studyActivity === "QUESTIONS";
  const validResults = !isQuestions || questions > 0;
  const validMinutes = Number.isInteger(studyMinutes) && studyMinutes > 0;
  const activityLabel = STUDY_ACTIVITY_LABELS[studyActivity];
  const timeLabel = studyActivity === "CLASS" ? "Tempo da videoaula (min)" : studyActivity === "READING" ? "Tempo de leitura da lei seca (min)" : studyActivity === "PDF_READING" ? "Tempo de leitura do PDF/material (min)" : "Tempo líquido estudado (min)";
  const goalProgress = Math.min(100, summary.dailyGoal ? summary.todayQuestions / summary.dailyGoal * 100 : 0);

  const modes = [
    { value: "QUESTIONS", label: "Questões & Prática", accessibleLabel: "Questões", icon: ListChecks },
    { value: "TIMER", label: "Cronômetro Líquido", accessibleLabel: "Cronômetro", icon: Clock3 },
    { value: "CONTENT", label: "Teoria / Resumos", accessibleLabel: "Conteúdo", icon: BookOpenCheck },
  ] as const;
  const actionClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60";
  const panel = (
    <div className={focusMode ? "study-panel mx-auto max-w-4xl" : "study-panel"}>
      <section aria-labelledby="study-subject" className="min-w-0">
        <div className="study-heading">
          <div className="study-cycle-line"><span className="study-cycle-tag">Ciclo atual · volta {current.round ?? 1}</span><span>Posição #{current.position ?? "avulsa"}{referencePresentation && current.position ? ` de ${referencePresentation.positions}` : ""}</span><span className="study-discipline">{current.discipline}</span></div>
          <h2 id="study-subject">{referencePresentation ? current.discipline : current.subject}</h2>
          <p data-study-subtitle className="study-subtitle">{referencePresentation ? current.subject : current.discipline}</p>
          <div className="study-metadata">
            <span><Clock3 size={12} aria-hidden /> Meta: <b>{current.goal} questões</b></span>
            <span>Peso: <b>{current.weight.toFixed(1)}</b></span>
            <span><i aria-hidden /> Prioridade: <b>{current.average < 70 ? "Alta" : "Normal"}</b></span>
            <details><summary>Desempenho prévio: <b>{current.average.toFixed(0)}%</b></summary><div>Último estudo: {relativeDate(current.last)}</div></details>
            {active?.status === "ACTIVE" && !focusMode ? <button onClick={() => setFocusMode(true)} className="study-focus-link"><Focus size={14} /> Modo foco</button> : null}
          </div>
        </div>
        <div data-study-workspace className="sf-surface study-workspace">
        <div role="tablist" aria-label="Modos de estudo" className="mx-auto mt-4 grid max-w-md grid-cols-3 rounded-control bg-elevated p-1">
          {modes.map(({ value, label, accessibleLabel, icon: Icon }, index) => <button key={value} id={`study-tab-${value}`} role="tab" aria-label={accessibleLabel} aria-selected={visualMode === value} aria-controls="study-mode-panel" tabIndex={visualMode === value ? 0 : -1} onClick={() => setVisualMode(value)} onKeyDown={(event) => {
            const nextIndex = event.key === "ArrowRight" ? (index + 1) % modes.length : event.key === "ArrowLeft" ? (index + modes.length - 1) % modes.length : event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : -1;
            if (nextIndex >= 0) { event.preventDefault(); setVisualMode(modes[nextIndex].value); document.getElementById(`study-tab-${modes[nextIndex].value}`)?.focus(); }
          }} className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-control px-1 text-xs font-semibold sm:min-h-11 sm:text-sm ${visualMode === value ? "bg-primary text-white" : "text-textSecondary hover:text-primary"}`}><Icon size={16} aria-hidden />{label}</button>)}
        </div>
        <div id="study-mode-panel" role="tabpanel" aria-labelledby={`study-tab-${visualMode}`} className="relative mt-2 overflow-hidden bg-surface px-3 py-4 text-center sm:px-6 sm:py-5">

          {visualMode === "QUESTIONS" ? <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-primary">Meta proposta do ciclo</p>
            <div className="study-target"><p className="text-6xl font-semibold tracking-tight sm:text-7xl">{current.goal}</p><span className="text-lg text-textSecondary dark:text-textSecondary">questões</span></div>
            <p className="study-description">O cronômetro é flexível e opcional. Ao concluir seu bloco de questões, registre os acertos e o tempo despendido.</p>
            <div className="study-question-actions"><button disabled={busy} onClick={() => active ? openFinish(active, seconds, "QUESTIONS") : act({ command: "start", mode: "CYCLE", timerRunning: false }, { openFinish: true, activity: "QUESTIONS" })} className={`mt-4 ${actionClass}`}><ListChecks size={14} /> Registrar questões</button><button type="button" className="study-timer-switch" onClick={() => setVisualMode("TIMER")}><Clock3 size={13} /> Usar cronômetro integrado</button></div>
          </> : visualMode === "CONTENT" ? <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-primary">Sessão de conteúdo</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Tempo para aprender.</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-textSecondary dark:text-textSecondary">Registre videoaula, lei seca ou PDF/material deste assunto. Informe o tempo dedicado antes de salvar.</p>
            <p className="mt-4 text-xs text-textSecondary dark:text-textSecondary">{current.discipline} · {current.subject}</p>
            <button disabled={busy} onClick={() => active ? openFinish(active, seconds, "CLASS") : act({ command: "start", mode: "CYCLE", timerRunning: false }, { openFinish: true, activity: "CLASS" })} className={`mt-4 ${actionClass}`}><BookOpenCheck size={18} /> Registrar conteúdo</button>
          </> : <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-primary">{studying ? active?.status === "ACTIVE" ? "Tempo decorrido" : "Tempo medido" : "Seu tempo de foco"}</p>
            <p className="mt-3 text-center text-[2.75rem] font-semibold tracking-tight tabular-nums sm:text-6xl">{duration(studying ? seconds : 0)}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {!studying ? <button disabled={busy} onClick={() => act({ command: "start", mode: "CYCLE", timerRunning: true })} className={actionClass}><Play size={17} /> Iniciar cronômetro</button> : <>
                {active?.status === "ACTIVE" ? <button disabled={busy} onClick={() => act({ command: "pause", id: active.id, version: active.version })} className="inline-flex min-h-12 items-center gap-2 px-3 text-sm font-semibold text-primary disabled:opacity-60 dark:text-primary"><Pause size={17} /> Pausar</button> : <button disabled={busy} onClick={() => act({ command: "resume", id: active!.id, version: active!.version })} className="inline-flex min-h-12 items-center gap-2 px-3 text-sm font-semibold text-primary disabled:opacity-60 dark:text-primary"><Play size={17} /> Iniciar cronômetro</button>}
                <button disabled={busy} onClick={() => active && openFinish(active, seconds)} className={actionClass}><Check size={17} /> Finalizar e registrar</button>
              </>}
            </div>
          </>}
          <div className="study-workspace-note">
            <span>{questions} questões neste registro · {studying ? active?.status === "ACTIVE" ? "Sessão em andamento" : "Registro em andamento" : "O cronômetro é opcional; ajuste o tempo antes de salvar."}</span>
            {active ? <button disabled={busy} onClick={() => window.confirm("Cancelar sem salvar ou avançar o ciclo?") && act({ command: "cancel", id: active.id, version: active.version })} className="inline-flex min-h-11 items-center gap-1 font-semibold text-rose-700 dark:text-rose-300"><X size={14} /> Cancelar</button> : null}
          </div>
        </div>
        </div>
      </section>
      {!focusMode ? <aside className="study-context-strip study-footer">
        {showStandaloneLink ? <div className="study-standalone"><Link href="/registro?novo=1"><span aria-hidden>＋</span> Registrar estudo avulso (fora do ciclo)</Link></div> : null}
        <section aria-label="Progresso de hoje" className="study-today"><div><p><b>Hoje: {summary.todayQuestions}/{summary.dailyGoal} q.</b></p><p>{Math.floor(summary.todayMinutes / 60)}h {summary.todayMinutes % 60}min acumuladas · {summary.streak} dias seguidos</p></div><div className="study-day-progress" role="progressbar" aria-label="Progresso de questões hoje" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalProgress}><div style={{ width: goalProgress + "%" }} /></div></section>
        {nextSuggestion ? <section aria-label="Próximo assunto" className="study-next"><span>A seguir:</span><div><b>{nextSuggestion.discipline}</b><span>{nextSuggestion.subject}</span>{nextSuggestion.position ? <small>#{nextSuggestion.position}</small> : null}</div></section> : null}
        <section aria-label="Contexto do assunto" className="sr-only"><p>Média {current.average.toFixed(0)}% · Peso {current.weight} · Posição #{current.position ?? "avulsa"} · Último estudo {relativeDate(current.last)}</p></section>
      </aside> : null}
    </div>
  );
  return <>
    {focusMode ? <div className="fixed inset-0 z-[100] overflow-y-auto bg-backgroundLight p-4 dark:bg-backgroundDark sm:p-8"><div className="mb-6 flex justify-end"><button onClick={() => setFocusMode(false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-surface px-4 text-sm font-semibold dark:border-white/10 dark:bg-elevated"><RotateCcw size={16} /> Sair do foco</button></div>{panel}</div> : panel}

    {finishOpen && active ? <div role="dialog" aria-modal="true" aria-labelledby="finish-title" className="fixed inset-0 z-[110] flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-6"><section className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-card bg-surface shadow-xl dark:bg-panelDark sm:max-h-[calc(100dvh-3rem)] sm:max-w-xl sm:rounded-card"><div className="shrink-0 border-b px-5 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Finalizar sessão</p><h3 id="finish-title" className="mt-1 text-lg font-semibold sm:text-xl">Registre o que foi estudado</h3></div><button aria-label="Fechar" onClick={() => setFinishOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-control border"><X size={18} /></button></div><p className="mt-2 text-sm text-textSecondary">{current.discipline} · {current.subject}</p></div>
      <div data-testid="finish-content" className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-4">
      <div className="mt-4"><p className="text-sm font-bold">O que você estudou?</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" aria-pressed={studyActivity === "QUESTIONS"} onClick={() => setStudyActivity("QUESTIONS")} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "QUESTIONS" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-white/10"}`}><ListChecks size={20} /> Questões</button>
        <button type="button" aria-pressed={studyActivity === "CLASS"} onClick={() => { setStudyActivity("CLASS"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "CLASS" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-white/10"}`}><Video size={20} /> Videoaula</button>
        <button type="button" aria-pressed={studyActivity === "READING"} onClick={() => { setStudyActivity("READING"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "READING" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-white/10"}`}><Scale size={20} /> Lei seca</button>
        <button type="button" aria-pressed={studyActivity === "PDF_READING"} onClick={() => { setStudyActivity("PDF_READING"); setCorrect(0); setWrong(0); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold ${studyActivity === "PDF_READING" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-white/10"}`}><FileText size={20} /> PDF/material</button>
      </div></div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold sm:col-span-2">{timeLabel}<span className="relative mt-1.5 block"><Clock3 aria-hidden size={16} className="absolute left-3 top-4 text-textSecondary" /><input aria-label={`${timeLabel.replace(" (min)", "")} em minutos`} inputMode="numeric" type="number" min={1} step={1} value={studyMinutes} onChange={(event) => setStudyMinutes(Math.max(0, Number(event.target.value) || 0))} className="h-12 w-full rounded-xl border border-slate-300 bg-surface pl-10 pr-3 text-lg font-semibold dark:border-white/10 dark:bg-elevated" /></span><span className="mt-1 block text-xs font-normal text-textSecondary">{seconds > 0 ? `Cronômetro: ${duration(seconds)}. Você pode corrigir o valor acima.` : `Informe o tempo real dedicado a ${activityLabel.toLocaleLowerCase("pt-BR")}.`}</span></label>
        {isQuestions ? <><label className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Acertos<input aria-label="Acertos" inputMode="numeric" type="number" min={0} value={correct} onChange={(event) => setCorrect(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-surface px-3 text-lg font-semibold dark:border-white/10 dark:bg-elevated" /></label><label className="text-sm font-bold text-rose-700 dark:text-rose-300">Erros<input aria-label="Erros" inputMode="numeric" type="number" min={0} value={wrong} onChange={(event) => setWrong(Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-surface px-3 text-lg font-semibold dark:border-white/10 dark:bg-elevated" /></label></> : <div className="sm:col-span-2 rounded-xl bg-primary/5 p-4 text-sm font-semibold text-textSecondary dark:text-textSecondary">{activityLabel} contará como uma sessão, somará o tempo informado e poderá concluir esta posição do ciclo.</div>}
      </div>

      {isQuestions ? <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm dark:bg-elevated"><div className="flex justify-between"><span>Total de questões</span><b>{questions}</b></div><div className="mt-2 flex justify-between"><span>Percentual de acertos</span><b>{questions ? `${percentage.toFixed(0)}%` : "—"}</b></div></div> : null}
      {!validMinutes ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">Informe ao menos 1 minuto de estudo.</p> : null}
      {!validResults ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">Informe ao menos um acerto ou erro.</p> : null}

      <div className="mt-4"><p className="text-sm font-bold">Dificuldade</p><div className="mt-2 grid grid-cols-3 gap-2">{([['Fácil', '🙂'], ['Média', '😐'], ['Difícil', '😓']] as const).map(([value, icon]) => <button key={value} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)} className={`min-h-16 rounded-xl border px-2 text-sm font-bold ${difficulty === value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-white/10"}`}><span aria-hidden className="block text-xl">{icon}</span>{value}</button>)}</div></div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10"><input type="checkbox" checked={advanceCycle} onChange={(event) => setAdvanceCycle(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span><span className="block text-sm font-semibold">Avançar para a próxima posição</span><span className="mt-0.5 block text-xs text-textSecondary">Desmarque se ainda vai continuar neste mesmo assunto.</span></span></label>
      <label className="mt-4 block text-sm font-bold">Observação <span className="font-normal text-textSecondary">(opcional)</span><textarea aria-label="Observação" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-surface p-3 dark:border-white/10 dark:bg-elevated" placeholder="O que revisar ou lembrar na próxima sessão?" /></label>
      </div><footer className="shrink-0 border-t bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button disabled={busy || !validMinutes || !validResults} onClick={() => act({ command: "finish", id: active.id, version: active.version, questions: isQuestions ? questions : 0, correct: isQuestions ? correct : 0, minutes: studyMinutes, activityType: studyActivity, advanceCycle, notes: `[${difficulty}] ${notes.trim()}`.trim() })} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"><Square size={17} /> {advanceCycle ? isQuestions ? "Salvar e concluir" : `Salvar ${activityLabel.toLocaleLowerCase("pt-BR")} e avançar` : "Salvar e continuar no assunto"}</button></footer>
    </section></div> : null}

    {completion ? <div role="status" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-5"><section className="w-full max-w-sm rounded-3xl bg-surface p-7 text-center shadow-2xl dark:bg-panelDark"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><Check size={28} /></span><h3 className="mt-4 text-2xl font-semibold">Registro concluído</h3><p className="mt-1 text-sm font-bold text-primary">{STUDY_ACTIVITY_LABELS[completion.activityType]}</p><p className="mt-2 text-sm text-textSecondary">{completion.percentage < 0 ? completion.advanced ? "O tempo informado foi somado e o ciclo avançou para a próxima posição." : "O tempo informado foi somado e este assunto continuará como a próxima atividade." : `Aproveitamento de ${completion.percentage.toFixed(0)}%. ${completion.advanced ? "O ciclo avançou." : "Você continuará neste assunto."}`}</p><button onClick={() => setCompletion(null)} className="mt-6 min-h-11 w-full rounded-xl bg-primary px-5 font-semibold text-white">Continuar</button></section></div> : null}
  </>;
}

