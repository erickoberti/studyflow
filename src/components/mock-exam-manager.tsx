"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CheckCircle2, Clock3, History, Scale, Send } from "lucide-react";
import { distributeQuestionsByWeight } from "@/lib/phase-five";

type Discipline = { id: string; name: string; weight: number };
type Exam = { id: string; title: string; takenAt: string; durationMinutes: number; totalQuestions: number; correct: number; wrong: number; percentage: number; notes: string | null; results: Array<{ id: string; questions: number; correct: number; percentage: number; discipline: { name: string } }> };

export function MockExamManager({ disciplines, exams }: { disciplines: Discipline[]; exams: Exam[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(100);
  const [rows, setRows] = useState(() => distributeQuestionsByWeight(100, disciplines).map((item) => ({ disciplineId: item.id, questions: item.questions, correct: 0 })));
  const [message, setMessage] = useState<string | null>(null);
  const calculated = useMemo(() => ({ questions: rows.reduce((sum, row) => sum + row.questions, 0), correct: rows.reduce((sum, row) => sum + row.correct, 0) }), [rows]);

  function redistribute() {
    setRows(distributeQuestionsByWeight(total, disciplines).map((item) => ({ disciplineId: item.id, questions: item.questions, correct: 0 })));
    setMessage(null);
  }
  function update(id: string, field: "questions" | "correct", value: number) {
    setRows((current) => current.map((row) => row.disciplineId === id ? { ...row, [field]: Math.max(0, value) } : row));
  }
  async function submit(formData: FormData) {
    setMessage(null);
    if (!calculated.questions || rows.some((row) => row.correct > row.questions)) return setMessage("Informe questões válidas e acertos menores ou iguais ao total.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/mock-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: formData.get("title"), takenAt: formData.get("takenAt"), durationMinutes: formData.get("durationMinutes"), notes: formData.get("notes"), results: rows }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(data.message ?? "Não foi possível salvar o simulado.");
      setMessage("Simulado salvo sem alterar o ciclo ou as sessões de estudo.");
      router.refresh();
    } catch {
      setMessage("Falha de conexão. O simulado não foi enviado; tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="space-y-7">
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <form action={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-panelDark sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Novo simulado</p><h2 className="mt-1 text-2xl font-black">Registrar resultado</h2><p className="mt-1 text-sm text-slate-500">Os resultados ficam isolados do ciclo e das sessões comuns.</p></div><Scale className="text-primary" /></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="sm:col-span-2"><span className="text-xs font-bold text-slate-500">Nome</span><input name="title" required defaultValue={`Simulado ${exams.length + 1}`} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 outline-none focus:border-primary" /></label>
          <label><span className="text-xs font-bold text-slate-500">Data</span><input name="takenAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 outline-none focus:border-primary" /></label>
          <label><span className="text-xs font-bold text-slate-500">Duração (min)</span><input name="durationMinutes" type="number" min="1" required defaultValue="180" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 outline-none focus:border-primary" /></label>
          <label className="sm:col-span-2"><span className="text-xs font-bold text-slate-500">Questões planejadas</span><div className="mt-1 flex gap-2"><input type="number" min="1" value={total} onChange={(event) => setTotal(Number(event.target.value))} className="min-h-11 min-w-0 flex-1 rounded-xl border bg-transparent px-3 outline-none focus:border-primary" /><button type="button" onClick={redistribute} className="rounded-xl border border-primary/30 px-3 text-xs font-black text-primary">Distribuir por peso</button></div></label>
        </div>
        <div className="mt-6 overflow-x-auto rounded-2xl border"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Disciplina</th><th className="p-3">Peso</th><th className="p-3">Questões</th><th className="p-3">Acertos</th><th className="p-3">%</th></tr></thead><tbody>{rows.map((row) => { const discipline = disciplines.find((item) => item.id === row.disciplineId)!; return <tr key={row.disciplineId} className="border-t"><td className="p-3 font-bold">{discipline.name}</td><td className="p-3">{discipline.weight}</td><td className="p-3"><input aria-label={`Questões de ${discipline.name}`} type="number" min="0" value={row.questions} onChange={(event) => update(row.disciplineId, "questions", Number(event.target.value))} className="w-20 rounded-lg border bg-transparent p-2" /></td><td className="p-3"><input aria-label={`Acertos de ${discipline.name}`} type="number" min="0" max={row.questions} value={row.correct} onChange={(event) => update(row.disciplineId, "correct", Number(event.target.value))} className="w-20 rounded-lg border bg-transparent p-2" /></td><td className="p-3 font-black">{row.questions ? (row.correct / row.questions * 100).toFixed(0) : 0}%</td></tr>; })}</tbody></table></div>
        <label className="mt-4 block"><span className="text-xs font-bold text-slate-500">Observações</span><textarea name="notes" placeholder="Pontos fortes, dificuldades e decisões para o próximo simulado." className="mt-1 min-h-24 w-full rounded-xl border bg-transparent p-3 outline-none focus:border-primary" /></label>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black">{calculated.questions} questões · {calculated.correct} acertos</p><p className="text-xs text-slate-500">{calculated.questions ? (calculated.correct / calculated.questions * 100).toFixed(1) : "0.0"}% de aproveitamento</p></div><button disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-white disabled:opacity-60"><Send size={16} /> {submitting ? "Salvando..." : "Salvar simulado"}</button></div>
        {message ? <p role="status" className="mt-3 text-sm font-semibold text-primary">{message}</p> : null}
      </form>
      <aside className="space-y-4"><Metric icon={History} label="Simulados realizados" value={String(exams.length)} /><Metric icon={BarChart3} label="Média histórica" value={`${(exams.length ? exams.reduce((sum, exam) => sum + exam.percentage, 0) / exams.length : 0).toFixed(1)}%`} /><Metric icon={CheckCircle2} label="Melhor resultado" value={`${(exams.length ? Math.max(...exams.map((exam) => exam.percentage)) : 0).toFixed(1)}%`} /><div className="rounded-3xl border border-primary/20 bg-primary/5 p-5"><p className="text-sm font-black text-primary">Como a distribuição funciona</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">O peso da disciplina é a soma dos pesos dos seus assuntos ativos. O arredondamento preserva exatamente o total planejado.</p></div></aside>
    </section>
    <section><div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Histórico</p><h2 className="text-2xl font-black">Evolução nos simulados</h2></div><div className="grid gap-4 lg:grid-cols-2">{exams.map((exam) => <article key={exam.id} className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black">{exam.title}</h3><p className="text-xs text-slate-500">{new Date(exam.takenAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {exam.durationMinutes} min</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-lg font-black text-primary">{exam.percentage.toFixed(1)}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-primary" style={{ width: `${Math.min(100, exam.percentage)}%` }} /></div><p className="mt-3 text-sm font-semibold">{exam.correct} acertos · {exam.wrong} erros · {exam.totalQuestions} questões</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{exam.results.map((result) => <div key={result.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="truncate text-xs font-bold">{result.discipline.name}</p><p className="mt-1 text-sm font-black">{result.percentage.toFixed(0)}% <span className="font-normal text-slate-500">({result.correct}/{result.questions})</span></p></div>)}</div>{exam.notes ? <p className="mt-4 text-sm text-slate-500">{exam.notes}</p> : null}</article>)}{!exams.length ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500 lg:col-span-2">Nenhum simulado registrado neste guia.</div> : null}</div></section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <article className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-panelDark"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{label}</p><Icon size={18} className="text-primary" /></div><p className="mt-2 text-3xl font-black">{value}</p></article>; }
