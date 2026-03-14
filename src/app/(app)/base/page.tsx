import Link from "next/link";
import { createDiscipline, createSubject, updateDiscipline } from "@/app/actions";
import { ImportBaseForm } from "@/components/forms/import-base-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";

export default async function BasePage({
  searchParams,
}: {
  searchParams?: { page?: string; tab?: string; import?: string; novo?: string; edit?: string };
}) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const tab = searchParams?.tab === "disciplinas" ? "disciplinas" : "assuntos";
  const showImport = searchParams?.import === "1";
  const showForm = searchParams?.novo === "1";
  const editDisciplineId = tab === "disciplinas" ? searchParams?.edit ?? "" : "";

  const [disciplines, subjectsRaw] = await Promise.all([
    prisma.discipline.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.subject.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      include: {
        discipline: true,
        cycleEntries: {
          where: { userId: user.id, studyGuideId: guide.id },
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

  const disciplineOrderMap = new Map<string, number>();
  for (const subject of subjects) {
    const order = subject.cycleEntries[0]?.orderIndex;
    if (order === undefined) continue;
    const current = disciplineOrderMap.get(subject.disciplineId);
    if (current === undefined || order < current) {
      disciplineOrderMap.set(subject.disciplineId, order);
    }
  }

  const editingDiscipline = editDisciplineId
    ? disciplines.find((discipline) => discipline.id === editDisciplineId) ?? null
    : null;

  const perPage = 10;
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const totalRows = tab === "disciplinas" ? disciplines.length : subjects.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(page, totalPages);

  const pagedDisciplines = disciplines.slice((currentPage - 1) * perPage, currentPage * perPage);
  const pagedSubjects = subjects.slice((currentPage - 1) * perPage, currentPage * perPage);
  const showDisciplineEditor = tab === "disciplinas" && (showForm || Boolean(editingDiscipline));

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Cadastro</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gerencie suas disciplinas e assuntos de estudo.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/api/export/csv"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-primary/20 dark:bg-[#161126] dark:text-slate-200"
          >
            Exportar
          </Link>
          <Link
            href={`/base?tab=${tab}&novo=${showForm ? "0" : "1"}`}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {showForm ? "Fechar" : "Novo registro"}
          </Link>
          <Link
            href={`/base?tab=${tab}&import=${showImport ? "0" : "1"}`}
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary"
          >
            Importar
          </Link>
        </div>
      </header>

      {showImport ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Importar cadastro-base</h3>
          <p className="mt-1 text-xs text-slate-500">Formato: Seq, Assunto, Peso, Disciplina, Onde marcar no TEC.</p>
          <ImportBaseForm />
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
        <div className="mb-4 flex items-center gap-6 border-b border-slate-200 pb-3 dark:border-primary/15">
          <Link
            href="/base?tab=disciplinas"
            className={`text-lg font-bold ${tab === "disciplinas" ? "text-primary" : "text-slate-500"}`}
          >
            Disciplinas
          </Link>
          <Link
            href="/base?tab=assuntos"
            className={`text-lg font-bold ${tab === "assuntos" ? "text-primary" : "text-slate-500"}`}
          >
            Assuntos
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {showDisciplineEditor ? (
            <div className="xl:col-span-4">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-primary/20 dark:bg-[#120e20]">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingDiscipline ? "Editar disciplina" : "Nova disciplina"}
                </h3>
                <form action={editingDiscipline ? updateDiscipline : createDiscipline} className="mt-4 space-y-3">
                  {editingDiscipline ? <input type="hidden" name="disciplineId" value={editingDiscipline.id} /> : null}
                  <input
                    name="name"
                    placeholder="Nome da disciplina"
                    required
                    defaultValue={editingDiscipline?.name ?? ""}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                  />
                  <input
                    name="sortOrder"
                    type="number"
                    min={1}
                    placeholder="Ordem da disciplina"
                    defaultValue={editingDiscipline?.sortOrder ?? ""}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-white">
                      {editingDiscipline ? "Salvar disciplina" : "Criar disciplina"}
                    </button>
                    <Link
                      href="/base?tab=disciplinas"
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-primary/30 dark:text-slate-300"
                    >
                      Cancelar
                    </Link>
                  </div>
                </form>
              </section>
            </div>
          ) : null}

          {showForm && tab === "assuntos" ? (
            <div className="xl:col-span-4">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-primary/20 dark:bg-[#120e20]">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo assunto</h3>
                <form action={createSubject} className="mt-4 space-y-3">
                  <select
                    name="disciplineId"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                  >
                    {disciplines.map((discipline) => (
                      <option key={discipline.id} value={discipline.id}>
                        {discipline.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="name"
                    placeholder="Titulo do assunto"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="weight"
                      type="number"
                      min={1}
                      max={5}
                      defaultValue={1}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                    />
                    <input
                      name="tecReference"
                      placeholder="Onde marcar no TEC"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                    />
                  </div>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Observacoes"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#0e0b18] dark:text-white"
                  />
                  <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white">Salvar assunto</button>
                </form>
              </section>
            </div>
          ) : null}

          <div className={`${showDisciplineEditor || (showForm && tab === "assuntos") ? "xl:col-span-8" : "xl:col-span-12"}`}>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-primary/20">
              {tab === "disciplinas" ? (
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-primary/5">
                    <tr>
                      <th className="px-5 py-3">Ordem</th>
                      <th className="px-5 py-3">Disciplina</th>
                      <th className="px-5 py-3">Assuntos</th>
                      <th className="px-5 py-3 text-right">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-primary/10">
                    {pagedDisciplines.map((discipline) => {
                      const count = subjects.filter((subject) => subject.disciplineId === discipline.id).length;
                      const order = discipline.sortOrder ?? disciplineOrderMap.get(discipline.id);
                      return (
                        <tr key={discipline.id}>
                          <td className="px-5 py-3 text-slate-500">{order ?? "-"}</td>
                          <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{discipline.name}</td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{count}</td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              href={`/base?tab=disciplinas&edit=${discipline.id}`}
                              className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                            >
                              Editar
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-primary/5">
                    <tr>
                      <th className="px-5 py-3">Ordem</th>
                      <th className="px-5 py-3">Assunto</th>
                      <th className="px-5 py-3">Disciplina</th>
                      <th className="px-5 py-3">Peso</th>
                      <th className="px-5 py-3">Observacoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-primary/10">
                    {pagedSubjects.map((subject) => (
                      <tr key={subject.id}>
                        <td className="px-5 py-3 text-slate-500">{subject.cycleEntries[0]?.orderIndex ?? "-"}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{subject.name}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{subject.discipline.name}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{subject.weight}</td>
                        <td className="px-5 py-3 text-slate-500">{subject.tecReference ?? subject.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center">
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-primary/20 dark:bg-[#120e20]">
                <Link
                  href={`/base?tab=${tab}&page=${Math.max(1, currentPage - 1)}${showForm ? "&novo=1" : ""}${editDisciplineId ? `&edit=${editDisciplineId}` : ""}`}
                  className="rounded-md px-3 py-2 text-xs font-bold text-slate-500 hover:bg-primary/10"
                >
                  {"<"}
                </Link>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const nextPage = idx + 1;
                  const active = nextPage === currentPage;
                  return (
                    <Link
                      key={nextPage}
                      href={`/base?tab=${tab}&page=${nextPage}${showForm ? "&novo=1" : ""}${editDisciplineId ? `&edit=${editDisciplineId}` : ""}`}
                      className={`rounded-md px-3 py-2 text-xs font-bold ${active ? "bg-primary text-white" : "text-slate-500 hover:bg-primary/10"}`}
                    >
                      {nextPage}
                    </Link>
                  );
                })}
                <Link
                  href={`/base?tab=${tab}&page=${Math.min(totalPages, currentPage + 1)}${showForm ? "&novo=1" : ""}${editDisciplineId ? `&edit=${editDisciplineId}` : ""}`}
                  className="rounded-md px-3 py-2 text-xs font-bold text-slate-500 hover:bg-primary/10"
                >
                  {">"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
