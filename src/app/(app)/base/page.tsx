import { createDiscipline, createSubject } from "@/app/actions";
import { ImportBaseForm } from "@/components/forms/import-base-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BasePage() {
  const user = await requireUser();
  const [disciplines, subjectsRaw] = await Promise.all([
    prisma.discipline.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({
      where: { userId: user.id },
      include: {
        discipline: true,
        cycleEntries: {
          where: { userId: user.id },
          orderBy: { orderIndex: "asc" },
          take: 1,
        },
      },
    }),
  ]);

  const subjects = [...subjectsRaw].sort((a, b) => {
    const orderA = a.cycleEntries[0]?.orderIndex ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.cycleEntries[0]?.orderIndex ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Cadastro-base</h1>
            <p className="text-sm text-slate-500">Use apenas disciplina + assunto, com peso e referência do TEC.</p>
          </div>
          <div className="rounded-xl bg-[#1152d4]/10 px-3 py-2 text-xs font-bold text-[#1152d4]">
            {disciplines.length} disciplinas • {subjects.length} assuntos
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form action={createDiscipline} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Nova disciplina</h2>
          <div className="mt-3 space-y-2">
            <input name="name" placeholder="Nome da disciplina" required className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <button className="mt-4 rounded-xl bg-[#1152d4] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Salvar disciplina</button>
        </form>

        <form action={createSubject} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Novo assunto</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select name="disciplineId" required className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800">
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </select>
            <input name="name" placeholder="Nome do assunto" required className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800" />
            <input name="weight" type="number" min={1} max={3} defaultValue={1} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            <input name="tecReference" placeholder="Onde marcar no TEC" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800" />
            <textarea name="notes" placeholder="Observações" rows={2} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <button className="mt-4 rounded-xl bg-[#1152d4] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Salvar assunto</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Importar planilha para cadastro-base</h3>
        <p className="mt-1 text-xs text-slate-500">Formato aceito: Seq, Assunto, Peso, Disciplina, Onde marcar no TEC.</p>
        <ImportBaseForm />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Tabela de assuntos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-5 py-3">Ordem</th>
                <th className="px-5 py-3">Disciplina</th>
                <th className="px-5 py-3">Assunto</th>
                <th className="px-5 py-3">Peso</th>
                <th className="px-5 py-3">Obs / TEC</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3">
                    {subject.cycleEntries[0]?.orderIndex ? (
                      <span className="rounded-full bg-[#1152d4]/10 px-2 py-0.5 text-xs font-bold text-[#1152d4]">
                        #{subject.cycleEntries[0].orderIndex}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-semibold">{subject.discipline.name}</td>
                  <td className="px-5 py-3">{subject.name}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-[#1152d4]/10 px-2 py-0.5 text-xs font-bold text-[#1152d4]">{subject.weight}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{subject.tecReference ?? subject.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}