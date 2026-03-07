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
      <header>
        <h1 className="text-3xl font-black text-white">Registrar Estudo</h1>
        <p className="mt-1 text-slate-400">Acompanhe seu progresso e mantenha a constancia no ciclo.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Sugestao automatica do ciclo</p>
          <h2 className="mt-1 text-3xl font-black text-white">{suggestion.next?.subject.name ?? "Sem sugestao"}</h2>
          <p className="text-sm text-slate-400">
            Ultimo: {suggestion.last?.subject.name ?? "-"} | Proximo: #{suggestion.next?.orderIndex ?? "-"}
          </p>
        </article>

        <article className="rounded-2xl border border-primary/20 bg-[#161126] p-5">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Importar planilha de registro diario</h3>
          <p className="mt-1 text-xs text-slate-500">Formato: Data, Peso, Disciplina, Assunto, Questoes, Acertos, Erros, % Dia, Meta %, Gap, Prioridade.</p>
          <ImportDailyForm />
        </article>
      </section>

      <StudySessionForm cycleEntries={cycleEntries} suggestedId={suggestion.next?.id} />
    </div>
  );
}
