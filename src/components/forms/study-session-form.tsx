"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, FileText, ListChecks, RefreshCcw, Search, Scale, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STUDY_ACTIVITY_LABELS, type StudyActivity } from "@/lib/study-activity";

export type StandaloneGuideOption = {
  id: string;
  name: string;
  disciplines: Array<{
    id: string;
    name: string;
    subjects: Array<{ id: string; name: string; weight: number }>;
  }>;
};

type RecentSession = {
  id: string;
  date: Date;
  questions: number;
  estimatedMinutes: number;
  activityType: StudyActivity;
  subjectName: string;
  disciplineName: string;
};

const DEFAULT_DIFFICULTY = "Média" as const;

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function timeKey(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function formatPtBrDay(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(date);
}

export function StudySessionForm({
  guides,
  initialGuideId,
  recentSessions,
  dailyQuestionsGoal,
  toggleHref,
}: {
  guides: StandaloneGuideOption[];
  initialGuideId: string;
  recentSessions?: RecentSession[];
  dailyQuestionsGoal: number;
  toggleHref: string;
}) {
  const router = useRouter();
  const [studyGuideId, setStudyGuideId] = useState(initialGuideId);
  const [disciplineId, setDisciplineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [disciplineSearch, setDisciplineSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [disciplineSearchOpen, setDisciplineSearchOpen] = useState(false);
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [time, setTime] = useState(() => timeKey(new Date()));
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [scope, setScope] = useState<"SUBJECT" | "GENERAL">("SUBJECT");
  const [activityType, setActivityType] = useState<StudyActivity>("QUESTIONS");
  const [correct, setCorrect] = useState("");
  const [wrong, setWrong] = useState("");
  const [difficulty, setDifficulty] = useState<"Fácil" | "Média" | "Difícil">(DEFAULT_DIFFICULTY);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedGuide = guides.find((guide) => guide.id === studyGuideId);
  const disciplines = selectedGuide?.disciplines ?? [];
  const normalizedDisciplineSearch = normalizeSearch(disciplineSearch);
  const filteredDisciplines = disciplines.filter((item) => normalizeSearch(item.name).includes(normalizedDisciplineSearch));
  const selectedDiscipline = disciplines.find((item) => item.id === disciplineId);
  const subjects = selectedDiscipline?.subjects ?? [];
  const normalizedSubjectSearch = normalizeSearch(subjectSearch);
  const filteredSubjects = subjects.filter((item) => normalizeSearch(item.name).includes(normalizedSubjectSearch));
  const correctNumber = Number(correct) || 0;
  const wrongNumber = Number(wrong) || 0;
  const questions = correctNumber + wrongNumber;
  const isGeneralReview = scope === "GENERAL";
  const collectsQuestions = activityType === "QUESTIONS" || isGeneralReview;
  const percentage = questions ? (correctNumber / questions) * 100 : 0;
  const today = dateKey(new Date());

  useEffect(() => {
    if (!disciplineId) return;
    setSubjectLoading(true);
    const timer = window.setTimeout(() => setSubjectLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, [disciplineId]);

  function resetForm() {
    const now = new Date();
    setStudyGuideId(initialGuideId);
    setDisciplineId("");
    setSubjectId("");
    setDisciplineSearch("");
    setSubjectSearch("");
    setDisciplineSearchOpen(false);
    setSubjectSearchOpen(false);
    setDate(dateKey(now));
    setTime(timeKey(now));
    setEstimatedMinutes(60);
    setScope("SUBJECT");
    setActivityType("QUESTIONS");
    setCorrect("");
    setWrong("");
    setDifficulty(DEFAULT_DIFFICULTY);
    setNotes("");
  }

  function changeGuide(value: string) {
    setStudyGuideId(value);
    setDisciplineId("");
    setSubjectId("");
    setDisciplineSearch("");
    setSubjectSearch("");
    setDisciplineSearchOpen(false);
    setSubjectSearchOpen(false);
    setStatus(null);
  }

  function changeDiscipline(value: string) {
    setDisciplineId(value);
    setSubjectId("");
    setSubjectSearch("");
    setDisciplineSearchOpen(false);
    setSubjectSearchOpen(false);
    setStatus(null);
  }

  function cancel() {
    if (loading) return;
    resetForm();
    router.push(toggleHref);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studyGuideId || (!isGeneralReview && (!disciplineId || !subjectId))) {
      const message = isGeneralReview ? "Selecione um guia." : "Selecione guia, disciplina e assunto.";
      setStatus({ type: "error", message }); toast.error(message); return;
    }
    if (collectsQuestions && questions <= 0) {
      const message = "Informe ao menos um acerto ou erro.";
      setStatus({ type: "error", message }); toast.error(message); return;
    }
    if (!date || !time || estimatedMinutes <= 0) {
      const message = "Informe data, horário e duração válidos.";
      setStatus({ type: "error", message }); toast.error(message); return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const response = await fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isGeneralReview
          ? { scope: "GENERAL", studyGuideId, date, time, correct: correctNumber, wrong: wrongNumber, estimatedMinutes, difficulty, notes }
          : { scope: "SUBJECT", studyGuideId, disciplineId, subjectId, date, time, correct: collectsQuestions ? correctNumber : 0, wrong: collectsQuestions ? wrongNumber : 0, estimatedMinutes, activityType, difficulty, notes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Erro ao salvar registro.");

      resetForm();
      const successMessage = isGeneralReview ? "Revisão geral salva. Questões e tempo foram contabilizados sem alterar o ciclo." : "Estudo avulso salvo. O ciclo permaneceu na mesma posição.";
      setStatus({ type: "success", message: successMessage });
      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar registro.";
      setStatus({ type: "error", message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const difficultyOptions = useMemo(() => [["Fácil", "🙂"], ["Média", "😐"], ["Difícil", "😓"]] as const, []);

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-panelDark sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Modo avulso</p><h2 className="mt-1 text-2xl font-black">Registrar estudo realizado</h2><p className="mt-1 text-sm text-slate-500">Escolha livremente o conteúdo e quando ele foi estudado.</p></div>
          <button type="button" onClick={cancel} disabled={loading} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold disabled:opacity-60 dark:border-slate-700">Fechar</button>
        </div>

        {status ? <p role={status.type === "error" ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm font-semibold ${status.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"}`}>{status.message}</p> : null}

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist" aria-label="Tipo de registro avulso">
          <button type="button" role="tab" aria-selected={!isGeneralReview} onClick={() => { setScope("SUBJECT"); setActivityType("QUESTIONS"); setStatus(null); }} className={`min-h-12 rounded-xl px-3 text-sm font-black ${!isGeneralReview ? "bg-white text-primary shadow dark:bg-slate-800" : "text-slate-500"}`}><ListChecks className="mr-2 inline" size={17} />Por matéria</button>
          <button type="button" role="tab" aria-selected={isGeneralReview} onClick={() => { setScope("GENERAL"); setActivityType("REVIEW"); setDisciplineId(""); setSubjectId(""); setStatus(null); }} className={`min-h-12 rounded-xl px-3 text-sm font-black ${isGeneralReview ? "bg-white text-primary shadow dark:bg-slate-800" : "text-slate-500"}`}><RefreshCcw className="mr-2 inline" size={17} />Revisão geral</button>
        </div>

        <form onSubmit={submit} noValidate>
          <fieldset disabled={loading} className="space-y-5 disabled:opacity-70">
            {!isGeneralReview ? <div><p className="text-sm font-bold">O que você estudou?</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" aria-pressed={activityType === "QUESTIONS"} onClick={() => setActivityType("QUESTIONS")} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-bold ${activityType === "QUESTIONS" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><ListChecks size={19} /> Questões</button>
              <button type="button" aria-pressed={activityType === "CLASS"} onClick={() => { setActivityType("CLASS"); setCorrect(""); setWrong(""); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-bold ${activityType === "CLASS" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><Video size={19} /> Videoaula</button>
              <button type="button" aria-pressed={activityType === "READING"} onClick={() => { setActivityType("READING"); setCorrect(""); setWrong(""); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-bold ${activityType === "READING" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><Scale size={19} /> Lei seca</button>
              <button type="button" aria-pressed={activityType === "PDF_READING"} onClick={() => { setActivityType("PDF_READING"); setCorrect(""); setWrong(""); }} className={`inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-bold ${activityType === "PDF_READING" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}><FileText size={19} /> PDF/material</button>
            </div></div> : <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="font-black text-primary">Revisão de todas as matérias</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Registre o resultado consolidado do caderno. Ele entra nas metas e estatísticas gerais, sem ser atribuído a uma matéria e sem avançar o ciclo.</p></div>}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">Guia
                <select aria-label="Guia" value={studyGuideId} onChange={(event) => changeGuide(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Selecione um guia</option>{guides.map((guide) => <option key={guide.id} value={guide.id}>{guide.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-bold">Data
                  <span className="relative mt-1.5 block"><CalendarDays aria-hidden size={16} className="absolute left-3 top-4 text-slate-400" /><input aria-label="Data do estudo" type="date" max={today} required value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-2 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900" /></span>
                </label>
                <label className="text-sm font-bold">Horário
                  <input aria-label="Horário do estudo" type="time" required value={time} onChange={(event) => setTime(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900" />
                </label>
              </div>
            </div>

            {!isGeneralReview ? <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-bold" htmlFor="standalone-discipline">Disciplina</label>
                {disciplines.length > 8 ? <div className="relative mt-1.5"><label className="relative block"><span className="sr-only">Pesquisar disciplina</span><Search aria-hidden size={16} className="absolute left-3 top-3.5 text-slate-400" /><input type="search" role="combobox" aria-expanded={disciplineSearchOpen && Boolean(normalizedDisciplineSearch)} aria-controls="standalone-discipline-results" autoComplete="off" placeholder="Pesquisar disciplina" value={disciplineSearch} onFocus={() => setDisciplineSearchOpen(true)} onBlur={() => setDisciplineSearchOpen(false)} onChange={(event) => { setDisciplineSearch(event.target.value); setDisciplineSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && filteredDisciplines.length === 1) { event.preventDefault(); changeDiscipline(filteredDisciplines[0].id); } }} className="h-11 w-full rounded-t-xl border border-b-0 border-slate-300 bg-white pl-10 pr-3 outline-none dark:border-slate-700 dark:bg-slate-900" /></label>{disciplineSearchOpen && normalizedDisciplineSearch ? <div id="standalone-discipline-results" role="listbox" className="absolute z-20 max-h-60 w-full overflow-y-auto rounded-b-xl border border-slate-300 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">{filteredDisciplines.length ? filteredDisciplines.map((item) => <button key={item.id} type="button" role="option" aria-selected={disciplineId === item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => changeDiscipline(item.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10 focus:bg-primary/10 focus:outline-none">{item.name}</button>) : <p role="status" className="px-3 py-2 text-sm text-slate-500">Nenhuma disciplina encontrada.</p>}</div> : null}</div> : null}
                <select id="standalone-discipline" aria-label="Disciplina" value={disciplineId} onChange={(event) => changeDiscipline(event.target.value)} disabled={!studyGuideId || disciplines.length === 0} className={`h-12 w-full border border-slate-300 bg-white px-3 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800 ${disciplines.length > 8 ? "rounded-b-xl" : "mt-1.5 rounded-xl"}`}>
                  <option value="">{disciplines.length ? "Selecione uma disciplina" : "Nenhuma disciplina ativa"}</option>{disciplines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div aria-busy={subjectLoading}>
                <label className="text-sm font-bold" htmlFor="standalone-subject">Assunto</label>
                {subjects.length > 8 ? <div className="relative mt-1.5"><label className="relative block"><span className="sr-only">Pesquisar assunto</span><Search aria-hidden size={16} className="absolute left-3 top-3.5 text-slate-400" /><input type="search" role="combobox" aria-expanded={subjectSearchOpen && Boolean(normalizedSubjectSearch)} aria-controls="standalone-subject-results" autoComplete="off" placeholder="Pesquisar assunto" value={subjectSearch} onFocus={() => setSubjectSearchOpen(true)} onBlur={() => setSubjectSearchOpen(false)} onChange={(event) => { setSubjectSearch(event.target.value); setSubjectSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && filteredSubjects.length === 1) { event.preventDefault(); setSubjectId(filteredSubjects[0].id); setSubjectSearch(""); setSubjectSearchOpen(false); } }} className="h-11 w-full rounded-t-xl border border-b-0 border-slate-300 bg-white pl-10 pr-3 outline-none dark:border-slate-700 dark:bg-slate-900" /></label>{subjectSearchOpen && normalizedSubjectSearch ? <div id="standalone-subject-results" role="listbox" className="absolute z-20 max-h-60 w-full overflow-y-auto rounded-b-xl border border-slate-300 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">{filteredSubjects.length ? filteredSubjects.map((item) => <button key={item.id} type="button" role="option" aria-selected={subjectId === item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSubjectId(item.id); setSubjectSearch(""); setSubjectSearchOpen(false); setStatus(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10 focus:bg-primary/10 focus:outline-none">{item.name} · peso {item.weight}</button>) : <p role="status" className="px-3 py-2 text-sm text-slate-500">Nenhum assunto encontrado.</p>}</div> : null}</div> : null}
                <select id="standalone-subject" aria-label="Assunto" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={!disciplineId || subjectLoading || subjects.length === 0} className={`h-12 w-full border border-slate-300 bg-white px-3 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800 ${subjects.length > 8 ? "rounded-b-xl" : "mt-1.5 rounded-xl"}`}>
                  <option value="">{subjectLoading ? "Carregando assuntos..." : !disciplineId ? "Escolha uma disciplina primeiro" : subjects.length ? "Selecione um assunto" : "Nenhum assunto ativo nesta disciplina"}</option>{!subjectLoading ? subjects.map((item) => <option key={item.id} value={item.id}>{item.name} · peso {item.weight}</option>) : null}
                </select>
                {disciplineId && !subjectLoading && subjects.length === 0 ? <p role="status" className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Esta disciplina não possui assuntos ativos.</p> : null}
              </div>
            </div> : null}

            <div className={`grid gap-4 ${collectsQuestions ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
              <label className="text-sm font-bold">Duração (min)
                <span className="relative mt-1.5 block"><Clock3 aria-hidden size={16} className="absolute left-3 top-4 text-slate-400" /><input aria-label="Duração em minutos" inputMode="numeric" type="number" min={1} required value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(Number(event.target.value) || 0)} className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900" /></span>
              </label>
              {collectsQuestions ? <><label className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Acertos
                <input aria-label="Acertos" inputMode="numeric" type="number" min={0} value={correct} onChange={(event) => setCorrect(event.target.value)} placeholder="0" className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900" />
              </label>
              <label className="text-sm font-bold text-rose-700 dark:text-rose-300">Erros
                <input aria-label="Erros" inputMode="numeric" type="number" min={0} value={wrong} onChange={(event) => setWrong(event.target.value)} placeholder="0" className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900" />
              </label></> : null}
            </div>

            {collectsQuestions ? <div className="rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-900"><div className="flex justify-between"><span>Total de questões</span><b data-testid="standalone-total">{questions}</b></div><div className="mt-2 flex justify-between"><span>Percentual de acertos</span><b data-testid="standalone-percentage">{questions ? `${percentage.toFixed(0)}%` : "—"}</b></div><div className="mt-2 flex justify-between"><span>Meta da sessão</span><b>{questions}/{dailyQuestionsGoal}</b></div></div> : <div className="rounded-xl bg-primary/5 p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">O tempo e a sessão serão contabilizados sem adicionar questões.</div>}

            <div><p className="text-sm font-bold">Dificuldade</p><div className="mt-2 grid grid-cols-3 gap-2">{difficultyOptions.map(([value, icon]) => <button key={value} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)} className={`min-h-16 rounded-xl border px-2 text-sm font-bold ${difficulty === value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}><span aria-hidden className="block text-xl">{icon}</span>{value}</button>)}</div></div>
            <label className="block text-sm font-bold">Observação <span className="font-normal text-slate-400">(opcional)</span><textarea aria-label="Observação" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="O que revisar ou lembrar na próxima sessão?" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900" /></label>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800"><button type="button" onClick={cancel} className="min-h-12 rounded-xl border border-slate-300 px-6 font-bold dark:border-slate-700">Cancelar</button><button type="submit" className="min-h-12 rounded-xl bg-primary px-7 font-black text-white shadow-soft disabled:opacity-60">{loading ? "Salvando..." : isGeneralReview ? "Salvar revisão geral" : "Salvar estudo avulso"}</button></div>
          </fieldset>
        </form>
      </article>

      <aside className="space-y-4"><article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><p className="text-xs font-black uppercase tracking-wider text-primary">Garantia do modo avulso</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Este registro atualiza histórico, calendário e estatísticas na data escolhida, sem avançar nem reposicionar o ciclo.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><h3 className="font-black">Registros recentes</h3><div className="mt-3 space-y-3">{recentSessions?.length ? recentSessions.map((session) => <div key={session.id} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0 dark:border-slate-800"><p className="text-sm font-bold">{session.disciplineName}</p><p className="truncate text-xs text-slate-500">{session.subjectName} · {session.activityType === "QUESTIONS" || (session.activityType === "REVIEW" && session.questions > 0) ? `${session.questions} questões` : `${STUDY_ACTIVITY_LABELS[session.activityType]} · ${session.estimatedMinutes} min`}</p><p className="mt-1 text-xs text-slate-400">{formatPtBrDay(session.date)}</p></div>) : <p className="text-sm text-slate-500">Nenhum registro neste guia.</p>}</div></article></aside>
    </section>
  );
}
