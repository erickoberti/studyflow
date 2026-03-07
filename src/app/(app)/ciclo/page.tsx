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
  "from-blue-500/25 to-blue-500/5 border-blue-500/35 text-blue-300",
  "from-emerald-500/25 to-emerald-500/5 border-emerald-500/35 text-emerald-300",
  "from-indigo-500/25 to-indigo-500/5 border-indigo-500/35 text-indigo-300",
  "from-amber-500/25 to-amber-500/5 border-amber-500/35 text-amber-300",
  "from-purple-500/25 to-purple-500/5 border-purple-500/35 text-purple-300",
  "from-cyan-500/25 to-cyan-500/5 border-cyan-500/35 text-cyan-300",
  "from-rose-500/25 to-rose-500/5 border-rose-500/35 text-rose-300",
];

function disciplineColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return DISCIPLINE_COLORS[hash % DISCIPLINE_COLORS.length];
}

function weightBars(weight: number) {
  const full = Math.max(1, Math.min(4, Math.round(weight)));
  return Array.from({ length: 4 }).map((_, idx) => idx < full);
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
  const pageEntries = entries.slice((currentPage - 1) * perPage, currentPage * perPage);

  const totalMinutes = entries.reduce((sum, entry) => sum + Math.max(30, Number(entry.subject.weight) * 45), 0);
  const coverage = Math.min(100, Math.round((entries.filter((entry) => entry.active).length / Math.max(1, entries.length)) * 100));

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Ciclo de Estudos</h1>
          <p className="mt-2 max-w-xl text-slate-400">Gerencie a ordem de prioridade e o tempo dedicado a cada materia do seu edital.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-primary/20 bg-[#161126] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cobertura</p>
            <p className="mt-1 text-4xl font-black text-white">{coverage}%</p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-primary/15">
              <div className="h-full rounded-full bg-primary" style={{ width: `${coverage}%` }} />
            </div>
          </article>
          <article className="rounded-xl border border-primary/20 bg-[#161126] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tempo total</p>
            <p className="mt-1 text-3xl font-black text-white">
              {Math.floor(totalMinutes / 60)}h {String(totalMinutes % 60).padStart(2, "0")}m
            </p>
            <p className="mt-2 text-xs text-slate-500">Aprox. peso medio {avgWeight.toFixed(1)}</p>
          </article>
          <form action={addCycleEntry} className="rounded-xl border border-primary/30 bg-primary/90 p-4 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Adicionar materia</p>
            <select name="subjectId" defaultValue={subjects[0]?.id} className="mt-3 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white">
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.discipline.name} - {subject.name}
                </option>
              ))}
            </select>
            <button type="submit" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/30">
              <Plus size={14} /> Adicionar
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Disciplinas do ciclo</h2>
            <span className="rounded border border-primary/20 bg-[#161126] px-2 py-0.5 text-xs font-bold text-slate-400">{entries.length} materias</span>
          </div>
          <button className="text-sm font-semibold text-slate-400">Ordenar</button>
        </div>

        {pageEntries.map((entry) => {
          const weight = Number(entry.subject.weight);
          const colorCls = disciplineColor(entry.subject.discipline.name);
          const minutes = Math.max(30, Math.round(weight * 45));

          return (
            <article
              key={entry.id}
              className={`rounded-xl border bg-gradient-to-r p-4 transition-colors ${entry.active ? "opacity-100" : "opacity-70"} ${colorCls}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 md:min-w-[250px]">
                  <GripVertical className="text-slate-500" size={17} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-primarySoft">Ordem #{entry.orderIndex}</p>
                    <p className="text-3xl font-black text-white">{entry.subject.name}</p>
                    <p className="text-xs text-slate-400">{entry.subject.discipline.name}</p>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Peso</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-bold text-white">{weight.toFixed(1)}</span>
                      <div className="flex gap-1">
                        {weightBars(weight).map((full, idx) => (
                          <span key={idx} className={`h-1.5 w-4 rounded-full ${full ? "bg-primary" : "bg-slate-700"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tempo</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-200">
                      {String(Math.floor(minutes / 60)).padStart(2, "0")}:{String(minutes % 60).padStart(2, "0")}:00
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</p>
                    <p className={`mt-1 text-lg font-bold ${entry.active ? "text-emerald-400" : "text-slate-500"}`}>{entry.active ? "Ativo" : "Inativo"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <form action={moveCycleEntry}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button className="rounded-md p-2 text-slate-400 hover:bg-primary/15 hover:text-white" title="Subir">
                      <ArrowUp size={14} />
                    </button>
                  </form>
                  <form action={moveCycleEntry}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button className="rounded-md p-2 text-slate-400 hover:bg-primary/15 hover:text-white" title="Descer">
                      <ArrowDown size={14} />
                    </button>
                  </form>
                  <form action={duplicateCycleEntry}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button className="rounded-md p-2 text-slate-400 hover:bg-primary/15 hover:text-white" title="Duplicar">
                      <Copy size={14} />
                    </button>
                  </form>
                  <form action={toggleCycleEntry}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button className="rounded-md p-2 text-slate-400 hover:bg-primary/15 hover:text-white" title="Ativar/Inativar">
                      <Power size={14} />
                    </button>
                  </form>
                  <form action={deleteCycleEntry}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button className="rounded-md p-2 text-red-300 hover:bg-red-500/15" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="flex items-center justify-between border-t border-primary/20 pt-5">
        <p className="text-sm text-slate-500">Arraste os cards para reorganizar a ordem de estudos do ciclo.</p>
        <div className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-[#161126] p-2">
          <Link href={`/ciclo?page=${Math.max(1, currentPage - 1)}`} className="rounded-md px-3 py-2 text-xs font-bold text-slate-400 hover:bg-primary/10">{"<"}</Link>
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
          <Link href={`/ciclo?page=${Math.min(totalPages, currentPage + 1)}`} className="rounded-md px-3 py-2 text-xs font-bold text-slate-400 hover:bg-primary/10">{">"}</Link>
        </div>
      </section>

      <section className="flex justify-end gap-3">
        <button className="rounded-xl border border-primary/20 bg-transparent px-6 py-2.5 text-sm font-bold text-slate-300">Resetar ciclo</button>
        <button className="rounded-xl border border-primary/40 bg-primary/20 px-6 py-2.5 text-sm font-bold text-primarySoft">Salvar alteracoes</button>
      </section>
    </div>
  );
}
