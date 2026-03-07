import Link from "next/link";
import { createDiscipline, createSubject } from "@/app/actions";
import { ImportBaseForm } from "@/components/forms/import-base-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BasePage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
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

  const perPage = 10;
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const totalPages = Math.max(1, Math.ceil(subjects.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageItems = subjects.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Cadastro-base</h1>
          <p className="mt-1 text-sm text-slate-400">Configure disciplinas, assuntos e pesos da sua base.</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-[#161126] px-4 py-2 text-xs font-bold text-primarySoft">
          {disciplines.length} disciplinas | {subjects.length} assuntos
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-4">
          <section className="rounded-xl border border-primary/20 bg-[#161126] p-5">
            <h3 className="text-base font-bold text-white">Nova disciplina</h3>
            <form action={createDiscipline} className="mt-4 space-y-3">
              <input
                name="name"
                placeholder="Nome da disciplina"
                required
                className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white"
              />
              <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white">Criar disciplina</button>
            </form>
          </section>

          <section className="rounded-xl border border-primary/20 bg-[#161126] p-5">
            <h3 className="text-base font-bold text-white">Adicionar assunto</h3>
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
                <label className="text-xs text-slate-400">
                  Peso
                  <input name="weight" type="number" min={1} max={3} defaultValue={1} className="mt-1 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">
                  Onde marcar no TEC
                  <input name="tecReference" placeholder="Ex: Adm Geral -> Processos" className="mt-1 w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
                </label>
              </div>
              <textarea name="notes" placeholder="Observacoes" rows={2} className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-2.5 text-sm text-white" />
              <button className="w-full rounded-lg border border-primary/30 bg-primary/15 py-2.5 text-sm font-bold text-primarySoft">Salvar assunto</button>
            </form>
          </section>

          <section className="rounded-xl border border-primary/20 bg-[#161126] p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Importar cadastro-base</h3>
            <p className="mt-1 text-xs text-slate-500">Formato: Seq, Assunto, Peso, Disciplina, Onde marcar no TEC.</p>
            <ImportBaseForm />
          </section>
        </div>

        <div className="xl:col-span-8">
          <section className="overflow-hidden rounded-xl border border-primary/20 bg-[#161126]">
            <div className="flex items-center justify-between border-b border-primary/15 p-5">
              <div>
                <h3 className="text-base font-bold text-white">Disciplinas e assuntos ativos</h3>
                <p className="text-xs text-slate-500">Ordenado pela coluna Seq do ciclo quando existir.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-primary/5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Ordem</th>
                    <th className="px-5 py-3">Disciplina</th>
                    <th className="px-5 py-3">Assunto</th>
                    <th className="px-5 py-3">Peso</th>
                    <th className="px-5 py-3">Onde marcar / Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {pageItems.map((subject) => (
                    <tr key={subject.id} className="hover:bg-primary/5">
                      <td className="px-5 py-3 text-xs text-slate-400">
                        {subject.cycleEntries[0]?.orderIndex ? (
                          <span className="rounded-full bg-primary/20 px-2 py-1 font-bold text-primarySoft">#{subject.cycleEntries[0].orderIndex}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-200">{subject.discipline.name}</td>
                      <td className="px-5 py-3 text-white">{subject.name}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-primary/20 px-2 py-1 text-xs font-bold text-primarySoft">{subject.weight}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">{subject.tecReference ?? subject.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center border-t border-primary/15 p-4">
              <div className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-[#120e20] p-1">
                <Link href={`/base?page=${Math.max(1, currentPage - 1)}`} className="rounded-md px-3 py-2 text-xs font-bold text-slate-400 hover:bg-primary/10">{"<"}</Link>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const p = idx + 1;
                  const active = p === currentPage;
                  return (
                    <Link
                      key={p}
                      href={`/base?page=${p}`}
                      className={`rounded-md px-3 py-2 text-xs font-bold ${active ? "bg-primary text-white" : "text-slate-400 hover:bg-primary/10"}`}
                    >
                      {p}
                    </Link>
                  );
                })}
                <Link href={`/base?page=${Math.min(totalPages, currentPage + 1)}`} className="rounded-md px-3 py-2 text-xs font-bold text-slate-400 hover:bg-primary/10">{">"}</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
