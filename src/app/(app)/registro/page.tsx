import { ImportDailyForm } from "@/components/forms/import-daily-form";
import { StudySessionForm } from "@/components/forms/study-session-form";
import { requireUser } from "@/lib/auth";
import { getNextCycleSuggestion } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export default async function RegistroPage() {
  const user = await requireUser();

  const [cycleEntries, suggestion] = await Promise.all([
    prisma.cycleEntry.findMany({
      where: { userId: user.id, active: true, subject: { active: true } },
      include: {
        subject: {
          include: {
            discipline: true,
          },
        },
      },
      orderBy: { orderIndex: "asc" },
    }),
    getNextCycleSuggestion(user.id),
  ]);

  return (
    <div className="space-y-5 pb-16 lg:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Registrar Estudo</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Acompanhe seu progresso e mantenha a constância no ciclo.</p>
        </div>

        <details className="w-full md:w-auto">
          <summary className="list-none cursor-pointer rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-sm font-bold text-primary hover:bg-primary/20 md:min-w-[140px]">
            Exportar
          </summary>
          <div className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126] md:w-[420px]">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Importar planilha de registro diário</h3>
            <p className="mt-1 text-xs text-slate-500">Formato: Data, Peso, Disciplina, Assunto, Questões, Acertos, Erros, % Dia, Meta %, Gap, Prioridade.</p>
            <ImportDailyForm />
          </div>
        </details>
      </header>

      <section className="grid grid-cols-1 gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Sugestão automática do ciclo</p>
          <h2 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{suggestion.next?.subject.name ?? "Sem sugestão"}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Último: {suggestion.last?.subject.name ?? "-"} | Próximo: #{suggestion.next?.orderIndex ?? "-"}
          </p>
        </article>
      </section>

      <StudySessionForm cycleEntries={cycleEntries} suggestedId={suggestion.next?.id} />
    </div>
  );
}
