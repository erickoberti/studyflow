import Link from "next/link";
import { ImportDailyForm } from "@/components/forms/import-daily-form";
import { StudySessionForm } from "@/components/forms/study-session-form";
import { requireUser } from "@/lib/auth";
import { getNextCycleSuggestion } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams?: { novo?: string; saved?: string };
}) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const showForm = searchParams?.novo === "1";
  const saved = searchParams?.saved ?? "";
  const successMessage =
    saved === "session-created"
      ? "Sessao registrada com sucesso."
      : saved === "session-updated"
        ? "Registro atualizado com sucesso."
        : "";

  const [cycleEntries, suggestion, recentSessions, settings] = await Promise.all([
    prisma.cycleEntry.findMany({
      where: { userId: user.id, studyGuideId: guide.id, active: true, subject: { active: true } },
      include: {
        subject: {
          include: {
            discipline: true,
          },
        },
      },
      orderBy: { orderIndex: "asc" },
    }),
    getNextCycleSuggestion(user.id, guide.id),
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        cycleEntry: {
          include: {
            subject: { include: { discipline: true } },
          },
        },
      },
    }),
    getStudyGuideSettings(user.id, guide.id),
  ]);

  return (
    <div className="space-y-5 pb-12 lg:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Registrar Estudo</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Insira os detalhes da sua sessão de estudo de hoje.</p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <Link href="/registros" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-sm font-bold text-primary hover:bg-primary/20 md:min-w-[170px]">
            Editar registros
          </Link>
          <details className="w-full md:w-auto">
            <summary className="list-none cursor-pointer rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-sm font-bold text-primary hover:bg-primary/20 md:min-w-[140px]">
              Importar planilha
            </summary>
            <div className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126] md:w-[440px]">
              <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Importar registro diário</h3>
              <p className="mt-1 text-xs text-slate-500">Formato: Data, Peso, Disciplina, Assunto, Questões, Acertos, Erros, % Dia, Meta %, Gap, Prioridade.</p>
              <ImportDailyForm />
            </div>
          </details>
        </div>
      </header>

      {successMessage ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {successMessage}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Sugestão automática do ciclo</p>
        <h2 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{suggestion.next?.subject.name ?? "Sem sugestão"}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Último: {suggestion.last?.subject.name ?? "-"} | Próximo: #{suggestion.next?.orderIndex ?? "-"}
        </p>
      </section>

      <StudySessionForm
        cycleEntries={cycleEntries}
        suggestedId={suggestion.next?.id}
        recentSessions={recentSessions}
        dailyQuestionsGoal={settings.dailyQuestionsGoal}
        returnTo="/registro?saved=session-created"
        showForm={showForm}
        toggleHref={showForm ? "/registro" : "/registro?novo=1"}
      />
    </div>
  );
}
