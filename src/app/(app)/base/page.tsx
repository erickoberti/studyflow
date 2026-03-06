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
    <div className="space-y-8 pb-16 lg:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black text-white">Cadastro-base</h1>
          <p className="mt-1 text-slate-400">Configure sua base de disciplinas e assuntos.</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-bold text-primarySoft">
          {disciplines.length} disciplinas | {subjects.length} assuntos
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-4">
          <section className="rounded-xl border border-primary/20 bg-[#161126] p-6">
            <h3 className="text-lg font-bold text-white">Nova disciplina</h3>
            <form action={createDiscipline} className="mt-4 space-y-4">
              <input
                name="name"
                placeholder="Nome da disciplina"
                required
                className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white"
              />
              <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white">Criar disciplina</button>
            </form>
          </section>

          <section className="rounded-xl border border-primary/20 bg-[#161126] p-6">
            <h3 className="text-lg font-bold text-white">Adicionar assunto</h3>
            <form action={createSubject} className="mt-4 space-y-3">
              <select name="disciplineId" required className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white">
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </select>
              <input name="name" placeholder="Nome do assunto" required className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input name="weight" type="number" min={1} max={3} defaultValue={1} className="rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
                <input name="tecReference" placeholder="Onde marcar no TEC" className="rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
              </div>
              <textarea name="notes" placeholder="Observacoes" rows={2} className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
              <button className="w-full rounded-lg border border-primary/30 bg-primary/15 py-2.5 text-sm font-bold text-primarySoft">Salvar assunto</button>
            </form>
          </section>

          <section className="rounded-xl border border-primary/20 bg-[#161126] p-6">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-400">Importar cadastro-base</h3>
            <p className="mt-1 text-xs text-slate-500">Formato: Seq, Assunto, Peso, Disciplina, Onde marcar no TEC.</p>
            <ImportBaseForm />
          </section>
        </div>

        <div className="xl:col-span-8">
          <section className="overflow-hidden rounded-xl border border-primary/20 bg-[#161126]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 p-5">
              <div>
                <h3 className="text-lg font-bold text-white">Disciplinas e assuntos ativos</h3>
                <p className="text-xs text-slate-500">Tabela ordenada pelo ciclo (coluna Seq importada).</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-primary/5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Ordem</th>
                    <th className="px-6 py-4">Disciplina</th>
                    <th className="px-6 py-4">Assunto</th>
                    <th className="px-6 py-4">Peso</th>
                    <th className="px-6 py-4">Obs / TEC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-primary/5">
                      <td className="px-6 py-4">
                        {subject.cycleEntries[0]?.orderIndex ? (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primarySoft">
                            #{subject.cycleEntries[0].orderIndex}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-200">{subject.discipline.name}</td>
                      <td className="px-6 py-4 text-white">{subject.name}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primarySoft">{subject.weight}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{subject.tecReference ?? subject.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-primary/20 bg-[#161126] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Media geral</p>
              <p className="mt-1 text-2xl font-black text-white">{subjects.length ? (subjects.reduce((acc, s) => acc + Number(s.weight), 0) / subjects.length).toFixed(1) : "0.0"}</p>
            </article>
            <article className="rounded-xl border border-primary/20 bg-[#161126] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Disciplinas</p>
              <p className="mt-1 text-2xl font-black text-white">{disciplines.length}</p>
            </article>
            <article className="rounded-xl border border-primary/20 bg-[#161126] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Assuntos</p>
              <p className="mt-1 text-2xl font-black text-white">{subjects.length}</p>
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}
