import Link from "next/link";
import {
  addCycleEntry,
  deleteCycleEntry,
  duplicateCycleEntry,
  moveCycleEntry,
  toggleCycleEntry,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Power, Trash2 } from "lucide-react";

const DISCIPLINE_COLORS = [
  "border-blue-500/30 bg-blue-500/15 text-blue-300",
  "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  "border-amber-500/30 bg-amber-500/15 text-amber-300",
  "border-purple-500/30 bg-purple-500/15 text-purple-300",
  "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
  "border-rose-500/30 bg-rose-500/15 text-rose-300",
];

function disciplineColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return DISCIPLINE_COLORS[hash % DISCIPLINE_COLORS.length];
}

function priorityLabel(weight: number) {
  if (weight >= 2) return { text: "Urgente", cls: "border-red-500/30 bg-red-500/15 text-red-300" };
  if (weight >= 1.5) return { text: "Bom", cls: "border-amber-500/30 bg-amber-500/15 text-amber-300" };
  return { text: "Forte", cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" };
}

export default async function CicloPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const user = await requireUser();

  const [subjects, entries] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id, active: true },
      include: { discipline: true },
      orderBy: [{ discipline: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.cycleEntry.findMany({
      where: { userId: user.id },
      include: { subject: { include: { discipline: true } } },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  const avgWeight = entries.length
    ? entries.reduce((sum, item) => sum + Number(item.subject.weight), 0) / entries.length
    : 0;

  const perPage = 10;
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const totalPages = Math.max(1, Math.ceil(entries.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageEntries = entries.slice(start, start + perPage);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black text-white">Gestao do Ciclo de Estudos</h1>
          <p className="mt-2 text-lg text-slate-400">Organize suas prioridades e otimize seu fluxo de aprendizado.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={addCycleEntry} className="flex gap-2">
            <select
              name="subjectId"
              className="w-56 rounded-xl border border-primary/30 bg-[#1b1530] px-3 py-2 text-sm text-white"
              defaultValue={subjects[0]?.id}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.discipline.name} - {subject.name}
                </option>
              ))}
            </select>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
              <Plus size={14} /> Adicionar materia
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Total de itens no ciclo</p>
          <p className="mt-1 text-4xl font-black text-white">{entries.length}</p>
        </article>
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Ciclos completos</p>
          <p className="mt-1 text-4xl font-black text-white">{Math.floor(entries.length / 18)}</p>
        </article>
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Peso medio</p>
          <p className="mt-1 text-4xl font-black text-white">{avgWeight.toFixed(1)}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-[#161126]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="border-b border-primary/20 bg-primary/5">
              <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-6 py-4">Ordem</th>
                <th className="px-6 py-4">Disciplina</th>
                <th className="px-6 py-4">Assunto</th>
                <th className="px-6 py-4">Peso</th>
                <th className="px-6 py-4">Prioridade</th>
                <th className="px-6 py-4 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {pageEntries.map((entry) => {
                const prio = priorityLabel(Number(entry.subject.weight));
                const disciplineCls = disciplineColor(entry.subject.discipline.name);
                return (
                  <tr key={entry.id} className="hover:bg-primary/5">
                    <td className="px-6 py-4 font-mono text-slate-400">{String(entry.orderIndex).padStart(2, "0")}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${disciplineCls}`}>
                        {entry.subject.discipline.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-lg font-semibold text-white">{entry.subject.name}</td>
                    <td className="px-6 py-4 text-2xl font-bold text-primarySoft">{Number(entry.subject.weight).toFixed(1)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-lg border px-3 py-1 text-xs font-black uppercase ${prio.cls}`}>{prio.text}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <form action={moveCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button className="rounded-lg p-2 text-slate-300 hover:bg-primary/15" title="Subir">
                            <ArrowUp size={14} />
                          </button>
                        </form>
                        <form action={moveCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button className="rounded-lg p-2 text-slate-300 hover:bg-primary/15" title="Descer">
                            <ArrowDown size={14} />
                          </button>
                        </form>
                        <form action={duplicateCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded-lg p-2 text-slate-300 hover:bg-primary/15" title="Duplicar">
                            <Copy size={14} />
                          </button>
                        </form>
                        <form action={toggleCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded-lg p-2 text-slate-300 hover:bg-primary/15" title="Ativar/Inativar">
                            <Power size={14} />
                          </button>
                        </form>
                        <form action={deleteCycleEntry}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="rounded-lg p-2 text-red-300 hover:bg-red-500/15" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </form>
                        <button className="rounded-lg p-2 text-slate-300 hover:bg-primary/15" title="Arrastar">
                          <GripVertical size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-[#161126] p-2">
          <Link
            href={`/ciclo?page=${Math.max(1, currentPage - 1)}`}
            className="rounded-md px-3 py-2 text-xs font-bold text-slate-400 hover:bg-primary/10"
          >
            {'<'}
          </Link>
          {Array.from({ length: totalPages }).map((_, idx) => {
            const p = idx + 1;
            const active = p === currentPage;
            return (
              <Link
                key={p}
                href={`/ciclo?page=${p}`}
                className={`rounded-md px-3 py-2 text-xs font-bold ${active ? "bg-primary text-white" : "text-slate-400 hover:bg-primary/10"}`}
              >
                {p}
              </Link>
            );
          })}
          <Link
            href={`/ciclo?page=${Math.min(totalPages, currentPage + 1)}`}
            className="rounded-md px-3 py-2 text-xs font-bold text-slate-400 hover:bg-primary/10"
          >
            {'>'}
          </Link>
        </div>
      </section>
    </div>
  );
}
