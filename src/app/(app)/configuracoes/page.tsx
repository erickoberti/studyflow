import { updateSettings } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });

  return (
    <div className="space-y-4">
      <form action={updateSettings} className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-black text-ink dark:text-white">Configurações e metas</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Meta de percentual
            <input
              name="targetPercentage"
              type="number"
              defaultValue={settings?.targetPercentage ?? 80}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Meta diária de questões
            <input
              name="dailyQuestionsGoal"
              type="number"
              defaultValue={settings?.dailyQuestionsGoal ?? 30}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Meta semanal de questões
            <input
              name="weeklyQuestionsGoal"
              type="number"
              defaultValue={settings?.weeklyQuestionsGoal ?? 200}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Viés de prioridade por peso
            <input
              name="weightPriorityBias"
              type="number"
              step="0.05"
              defaultValue={settings?.weightPriorityBias ?? 1.25}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="text-sm sm:col-span-2">
            Modo de tela
            <div className="mt-1">
              <ThemeToggle />
            </div>
          </div>
          <input type="hidden" name="theme" value={settings?.theme ?? "system"} />
        </div>
        <button className="mt-4 rounded-lg bg-brand px-4 py-2 font-semibold text-white">Salvar configurações</button>
      </form>

      <section className="grid gap-3 md:grid-cols-3">
        <a href="/api/export/csv" className="rounded-card border border-slate-200 bg-white p-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          Exportar registros para CSV
        </a>
        <a href="/api/backup" className="rounded-card border border-slate-200 bg-white p-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          Backup completo JSON
        </a>
        <form action="/api/import/base" method="post" encType="multipart/form-data" className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">Importar planilha (CSV)</p>
          <p className="mt-1 text-xs text-slate-500">Formato: Data, Peso, Disciplina, Assunto, Questões, Acertos, Erros, % Dia, Meta %, Gap, Prioridade, Obs.</p>
          <input type="file" name="file" accept=".csv" className="mt-2 text-xs" />
          <button className="mt-2 rounded-lg border px-3 py-1 text-sm">Importar</button>
        </form>
      </section>
    </div>
  );
}