import Link from "next/link";
import { buildStudyGuideCycleAction } from "@/app/actions";

type GuideSetupNoticeProps = {
  name: string;
  disciplines: number;
  subjects: number;
  cycleEntries: number;
  studyGuideId?: string;
  activeDisciplineNames?: string[];
};

export function GuideSetupNotice({ name, disciplines, subjects, cycleEntries, studyGuideId, activeDisciplineNames }: GuideSetupNoticeProps) {
  if (disciplines > 0 && subjects > 0 && cycleEntries > 0) return null;

  const nextStep = disciplines === 0
    ? { message: "Adicione sua primeira matéria. Ela já entrará no ciclo com Estudo geral. Detalhar os assuntos é opcional.", href: "/base?tab=disciplinas&novo=1", label: "Adicionar matéria" }
    : { message: "Suas matérias estão salvas. Monte o ciclo para começar a estudar; detalhar os assuntos é opcional.", href: "/guias", label: "Montar ciclo com minhas matérias" };
  const canRecover = cycleEntries === 0 && studyGuideId && activeDisciplineNames && activeDisciplineNames.length > 0;

  return (
    <section aria-label="Configuração do guia" className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
      <h2 className="text-lg font-semibold">Complete o guia {name}</h2>
      <p className="mt-1 text-sm text-textSecondary">{disciplines} disciplinas · {subjects} assuntos · {cycleEntries} posições no ciclo</p>
      <p className="mt-2 text-sm">{nextStep.message}</p>
      {disciplines > 0 && activeDisciplineNames?.length === 0 ? <p className="mt-2 text-sm">Ative ao menos uma disciplina abaixo para começar.</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {canRecover ? (
          <details className="w-full rounded-xl border border-primary/20 p-3">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Montar ciclo com minhas matérias</summary>
            <p className="mt-2 text-sm">Estas matérias ativas entrarão no ciclo. Para as que ainda não têm assuntos, será criado Estudo geral, que você pode editar depois.</p>
            <ul className="my-3 list-disc space-y-1 pl-5 text-sm">{activeDisciplineNames.map((discipline) => <li key={discipline}>{discipline}</li>)}</ul>
            <form action={buildStudyGuideCycleAction}>
              <input type="hidden" name="studyGuideId" value={studyGuideId} />
              <button className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">Montar ciclo e começar</button>
            </form>
          </details>
        ) : activeDisciplineNames?.length === 0 && disciplines > 0 ? null : (
          <Link href={nextStep.href} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">{nextStep.label}</Link>
        )}
        <Link href="/base?import=1" className="inline-flex min-h-11 items-center rounded-xl border border-primary/20 px-4 py-2 text-sm font-semibold text-primary">Importar disciplinas e assuntos</Link>
      </div>
    </section>
  );
}
