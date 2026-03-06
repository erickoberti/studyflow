import {
  addCycleEntry,
  deleteCycleEntry,
  duplicateCycleEntry,
  moveCycleEntry,
  toggleCycleEntry,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CicloPage() {
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

  const activeCount = entries.filter((entry) => entry.active).length;
  const disciplinesCount = new Set(entries.map((entry) => entry.subject.discipline.name)).size;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#1152d4]">Personalização estratégica</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Gestão do Ciclo de Estudos</h1>
            <p className="mt-1 text-sm text-slate-500">Organize a ordem das disciplinas por peso e relevância. Assuntos repetidos seguem por posição de ciclo.</p>
          </div>
          <form action={addCycleEntry} className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <select name="subjectId" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 lg:w-[380px]">
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.discipline.name} • {subject.name} (peso {subject.weight})
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-xl bg-[#1152d4] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Adicionar</button>
          </form>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Entradas no ciclo</span>
            <p className="text-lg font-black">{entries.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ativas</span>
            <p className="text-lg font-black">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Disciplinas cobertas</span>
            <p className="text-lg font-black">{disciplinesCount}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#1152d4]/50 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex w-10 flex-col items-center pt-0.5 text-slate-400">
                  <span className="text-xs font-bold">#{entry.orderIndex}</span>
                  <span className="text-lg">⋮⋮</span>
                </div>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#1152d4]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#1152d4]">
                      {entry.active ? "Em foco" : "Pausado"}
                    </span>
                    <span className="text-xs text-slate-500">{entry.subject.discipline.name}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{entry.subject.name}</h3>
                  <p className="text-sm text-slate-500">Peso {entry.subject.weight}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <form action={moveCycleEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">↑ Subir</button>
                </form>
                <form action={moveCycleEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">↓ Descer</button>
                </form>
                <form action={duplicateCycleEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <button className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Duplicar</button>
                </form>
                <form action={toggleCycleEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <button className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Ativar/Inativar</button>
                </form>
                <form action={deleteCycleEntry}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <button className="w-full rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/20">Excluir</button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}