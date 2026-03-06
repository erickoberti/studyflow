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
    <div className="space-y-4">
      <section className="rounded-card border border-brand/20 bg-white p-4 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Sugestão automática do ciclo</p>
        <h2 className="text-lg font-black text-ink dark:text-white">{suggestion.next?.subject.name ?? "Sem sugestão"}</h2>
        <p className="text-sm text-slate-500">
          Último: {suggestion.last?.subject.name ?? "-"} | Próximo: #{suggestion.next?.orderIndex ?? "-"}
        </p>
      </section>

      <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Importar planilha de registro diário</h3>
        <p className="mt-1 text-xs text-slate-500">Formato: Data, Peso, Disciplina, Assunto, Questões, Acertos, Erros, % Dia, Meta %, Gap (Meta - %), Prioridade.</p>
        <ImportDailyForm />
      </section>

      <StudySessionForm cycleEntries={cycleEntries} suggestedId={suggestion.next?.id} />
    </div>
  );
}