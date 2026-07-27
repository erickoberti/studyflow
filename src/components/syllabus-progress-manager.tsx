"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, PlayCircle, Search } from "lucide-react";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type Discipline = { id: string; name: string; subjects: Array<{ id: string; name: string; weight: number; status: Status }> };
const options: Array<{ value: Status; label: string }> = [{ value: "NOT_STARTED", label: "Não iniciado" }, { value: "IN_PROGRESS", label: "Em andamento" }, { value: "COMPLETED", label: "Concluído" }];

export function SyllabusProgressManager({ disciplines }: { disciplines: Discipline[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState(() => new Map(disciplines.flatMap((discipline) => discipline.subjects.map((subject) => [subject.id, subject.status]))));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = useMemo(() => disciplines.map((discipline) => ({ ...discipline, subjects: discipline.subjects.filter((subject) => `${discipline.name} ${subject.name}`.toLowerCase().includes(query.toLowerCase())) })).filter((discipline) => discipline.subjects.length), [disciplines, query]);
  async function update(subjectId: string, status: Status) {
    const before = local.get(subjectId) ?? "NOT_STARTED"; setLocal((current) => new Map(current).set(subjectId, status)); setPending(subjectId); setError(null);
    try {
      const response = await fetch("/api/syllabus-progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId, status }) });
      if (!response.ok) { setLocal((current) => new Map(current).set(subjectId, before)); const data = await response.json().catch(() => ({})); setError(data.message ?? "Não foi possível atualizar o edital."); }
      else router.refresh();
    } catch {
      setLocal((current) => new Map(current).set(subjectId, before)); setError("Falha de conexão. O progresso não foi alterado.");
    } finally {
      setPending(null);
    }
  }
  return <section className="rounded-3xl border bg-white p-5 dark:border-slate-800 dark:bg-panelDark sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Edital</p><h2 className="text-2xl font-black">Progresso por assunto</h2></div><label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 sm:w-72"><Search size={16} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar assunto" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
    <div className="mt-5 space-y-5">{visible.map((discipline) => <div key={discipline.id}><div className="mb-2 flex items-center justify-between"><h3 className="font-black">{discipline.name}</h3><span className="text-xs text-slate-500">{discipline.subjects.filter((item) => local.get(item.id) === "COMPLETED").length}/{discipline.subjects.length}</span></div><div className="grid gap-2 lg:grid-cols-2">{discipline.subjects.map((subject) => { const status = local.get(subject.id) ?? "NOT_STARTED"; const Icon = status === "COMPLETED" ? CheckCircle2 : status === "IN_PROGRESS" ? PlayCircle : Circle; return <article key={subject.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><Icon size={18} className={status === "COMPLETED" ? "text-emerald-500" : status === "IN_PROGRESS" ? "text-primary" : "text-slate-400"} /><div className="min-w-0"><p className="truncate text-sm font-bold">{subject.name}</p><p className="text-[11px] text-slate-500">Peso {subject.weight}</p></div></div><div className="relative"><select aria-label={`Status de ${subject.name}`} value={status} disabled={pending === subject.id} onChange={(event) => update(subject.id, event.target.value as Status)} className="min-h-10 w-full rounded-lg border bg-transparent px-3 pr-8 text-xs font-bold sm:w-36">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{pending === subject.id ? <Loader2 size={14} className="absolute right-2 top-3 animate-spin text-primary" /> : null}</div></article>; })}</div></div>)}{!visible.length ? <p className="py-8 text-center text-sm text-slate-500">Nenhum assunto encontrado.</p> : null}</div>
  </section>;
}
