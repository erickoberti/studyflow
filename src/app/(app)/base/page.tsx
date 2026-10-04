import shell from "@/components/official-shell.module.css";
import { DisciplineCatalog } from "@/components/discipline-catalog";
import Link from "next/link";
import {
  createDiscipline,
  createSubject,
  deleteAllGuideDisciplinesAction,
  deleteAllSubjectsAction,
  updateDiscipline,
  updateSubject,
} from "@/app/actions";
import { ImportBaseForm } from "@/components/forms/import-base-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";

export default async function BasePage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    discipline?: string;
    tab?: string;
    import?: string;
    novo?: string;
    edit?: string;
    editSubject?: string;
    saved?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const tab = params?.tab === "disciplinas" ? "disciplinas" : "assuntos";
  const showImport = params?.import === "1";
  const showForm = params?.novo === "1";
  const editDisciplineId = tab === "disciplinas" ? params?.edit ?? "" : "";
  const editSubjectId = tab === "assuntos" ? params?.editSubject ?? "" : "";
  const saved = params?.saved ?? "";

  const [disciplines, subjectsRaw] = await Promise.all([
    prisma.discipline.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      orderBy: [{ name: "asc" }],
    }),
    prisma.subject.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      include: {
        discipline: true, progress: true,
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

  const sortedDisciplines = [...disciplines].sort((a, b) => {
    const orderA = a.sortOrder ?? disciplineOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? disciplineOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  const editingDiscipline = editDisciplineId
    ? sortedDisciplines.find((discipline) => discipline.id === editDisciplineId) ?? null
    : null;
  const editingSubject = editSubjectId ? subjects.find((subject) => subject.id === editSubjectId) ?? null : null;

  const showDisciplineEditor = tab === "disciplinas" && (showForm || Boolean(editingDiscipline));
  const showSubjectEditor = tab === "assuntos" && (showForm || Boolean(editingSubject));
  const subjectRedirectTo = editingSubject ? "/base?tab=assuntos&saved=subject-updated" : "/base?tab=assuntos&saved=subject-created";
  const successMessage =
    saved === "subject-created"
      ? "Assunto criado com sucesso."
      : saved === "subject-updated"
        ? "Assunto atualizado com sucesso."
        : "";

  return (
    <div className={`${shell.screen} space-y-6 pb-16 lg:pb-0`}>
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">Cadastro de matérias &amp; edital · {disciplines.length} disciplinas · {subjects.length} tópicos mapeados</p><h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Disciplinas & Conteúdo Programático</h1>
          <p className="mt-1 text-sm text-textSecondary dark:text-textSecondary">
            Estruture seu edital com pesos, referências de questões e anotações estratégicas para guiar cada sessão de foco.
          </p>
        </div>
        <div className="flex shrink-0 gap-3"><Link href="/base?import=1" className="inline-flex max-w-48 items-center rounded-xl bg-surface px-5 py-3 text-center text-sm">Importar edital verticalizado</Link><Link href="/base?tab=disciplinas&novo=1" className="inline-flex max-w-40 items-center rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white">＋ Adicionar disciplina</Link></div>      </header>

      {showImport ? (
        <section className="space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-textSecondary">Importar cadastro-base</h3>
          <p className="mt-1 text-xs text-textSecondary">Baixe o modelo, preencha as colunas e envie o CSV.</p>
          <ImportBaseForm />
        </section>
      ) : null}

      {successMessage ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {successMessage}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-6">
          {showDisciplineEditor ? (
            <div className="max-w-md">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-primary/20 dark:bg-elevated">
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
                    className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                  />
                  <input
                    name="sortOrder"
                    type="number"
                    min={1}
                    placeholder="Ordem da disciplina"
                    defaultValue={editingDiscipline?.sortOrder ?? ""}
                    className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-white">
                      {editingDiscipline ? "Salvar disciplina" : "Criar disciplina"}
                    </button>
                    <Link
                      href="/base?tab=disciplinas"
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-textSecondary dark:border-primary/30 dark:text-textSecondary"
                    >
                      Cancelar
                    </Link>
                  </div>
                </form>
              </section>
            </div>
          ) : null}

          {showSubjectEditor ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-primary/20 dark:bg-elevated">
              <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 dark:border-primary/15 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingSubject ? "Editar assunto" : "Novo assunto"}
                  </h3>
                  <p className="mt-1 text-xs text-textSecondary dark:text-textSecondary">
                    Ajuste disciplina, ordem, peso e referencias sem abrir um painel lateral separado.
                  </p>
                </div>
                <Link
                  href="/base?tab=assuntos"
                  className="text-sm font-semibold text-textSecondary hover:text-slate-700 dark:text-textSecondary"
                >
                  Fechar
                </Link>
              </div>
              <form action={editingSubject ? updateSubject : createSubject} className="mt-4 space-y-4">
                {editingSubject ? <input type="hidden" name="subjectId" value={editingSubject.id} /> : null}
                <input type="hidden" name="redirectTo" value={subjectRedirectTo} />
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_120px_120px]">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-textSecondary dark:text-textSecondary">
                      Assunto
                    </label>
                    <input
                      name="name"
                      placeholder="Título do assunto"
                      required
                      defaultValue={editingSubject?.name ?? ""}
                      className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-textSecondary dark:text-textSecondary">
                      Disciplina
                    </label>
                    <select
                      name="disciplineId"
                      required
                      defaultValue={editingSubject?.disciplineId ?? params?.discipline ?? disciplines[0]?.id}
                      className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                    >
                      {disciplines.map((discipline) => (
                        <option key={discipline.id} value={discipline.id}>
                          {discipline.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-textSecondary dark:text-textSecondary">
                      Ordem
                    </label>
                    <input
                      name="orderIndex"
                      type="number"
                      min={1}
                      placeholder="Ordem"
                      defaultValue={editingSubject?.cycleEntries[0]?.orderIndex ?? ""}
                      className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-textSecondary dark:text-textSecondary">
                      Peso
                    </label>
                    <input
                      name="weight"
                      type="number"
                      min={1}
                      max={5}
                      defaultValue={editingSubject?.weight ?? 1}
                      className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[320px_1fr_auto]">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-textSecondary dark:text-textSecondary">
                      Referencia TEC
                    </label>
                    <input
                      name="tecReference"
                      placeholder="Onde marcar no TEC"
                      defaultValue={editingSubject?.tecReference ?? ""}
                      className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-textSecondary dark:text-textSecondary">
                      Observacoes
                    </label>
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Observacoes do assunto"
                      defaultValue={editingSubject?.notes ?? ""}
                      className="min-h-[68px] w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-backgroundDark dark:text-white"
                    />
                  </div>
                  <div className="flex items-end gap-2 self-stretch">
                    <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white">
                      {editingSubject ? "Salvar assunto" : "Criar assunto"}
                    </button>
                    <Link
                      href="/base?tab=assuntos"
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-textSecondary dark:border-primary/30 dark:text-textSecondary"
                    >
                      Cancelar
                    </Link>
                  </div>
                </div>
              </form>
            </section>
          ) : null}

          <DisciplineCatalog groups={sortedDisciplines.map(discipline => ({id:discipline.id,name:discipline.name,topics:subjects.filter(s=>s.disciplineId===discipline.id).map(s=>({id:s.id,name:s.name,weight:s.weight,notes:s.notes,tecReference:s.tecReference,active:s.active,questions:s.progress?.totalQuestions??0,percentage:s.progress?.averagePercentage??0,studied:Boolean(s.progress?.lastStudiedAt)}))}))} />
          <details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer text-sm">Gerenciar cadastro e exportação</summary><div className="flex flex-wrap gap-4 pt-4"><Link href="/api/export/csv" className="sf-secondary">Exportar</Link><Link href="/base?tab=assuntos&novo=1" className="sf-secondary">Novo assunto</Link><form action={deleteAllGuideDisciplinesAction}><button className="text-sm text-danger">Excluir todas disciplinas</button></form><form action={deleteAllSubjectsAction}><button className="text-sm text-danger">Excluir todos assuntos</button></form></div></details>        </div>
      </section>
    </div>
  );
}




