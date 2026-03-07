import { updateSettings } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });

  const dailyGoal = settings?.dailyQuestionsGoal ?? 30;
  const weeklyGoal = settings?.weeklyQuestionsGoal ?? 200;
  const target = settings?.targetPercentage ?? 80;
  const bias = settings?.weightPriorityBias ?? 1.25;

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <form action={updateSettings} className="space-y-8">
        <section>
          <h2 className="mb-4 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Perfil do Usuario</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-primary/20 dark:bg-[#161126]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="h-24 w-24 rounded-full border-4 border-primary/30 bg-primary/20" />
              <div className="flex-1">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{user.name ?? "Usuario"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email} • Plano Premium</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Editar detalhes</button>
                  <button type="button" className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">Alterar senha</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Metas de estudo</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">Meta diaria (questoes)</span>
                <span className="font-bold text-primary">{dailyGoal}</span>
              </div>
              <input
                name="dailyQuestionsGoal"
                type="number"
                min={1}
                defaultValue={dailyGoal}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-primary/20 dark:bg-[#161126]">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">Meta semanal (questoes)</span>
                <span className="font-bold text-primary">{weeklyGoal}</span>
              </div>
              <input
                name="weeklyQuestionsGoal"
                type="number"
                min={1}
                defaultValue={weeklyGoal}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </article>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Logica de prioridade</h3>
          <div className="space-y-3">
            <label className="flex items-start justify-between rounded-xl border border-primary/40 bg-primary/5 p-4 dark:bg-[#1b1630]">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Repeticao Espacada (SRS)</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Revisa topicos em intervalos ideais para fixacao.</p>
              </div>
              <input type="radio" checked readOnly className="mt-1" />
            </label>
            <label className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Focar em fraquezas</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Prioriza automaticamente os topicos com menor taxa de acerto.</p>
              </div>
              <input type="radio" readOnly className="mt-1" />
            </label>
            <label className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Progressao linear</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Segue a ordem cronologica sem pular etapas.</p>
              </div>
              <input type="radio" readOnly className="mt-1" />
            </label>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-primary/20 dark:bg-[#161126]">
              <p className="text-sm text-slate-600 dark:text-slate-300">Vies de prioridade por peso</p>
              <input
                name="weightPriorityBias"
                type="number"
                step="0.05"
                defaultValue={bias}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-primary/30 dark:bg-[#120e20] dark:text-white"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Preferencias de interface</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-primary/20 dark:bg-[#161126]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-primary/15">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Tema</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Alternar entre claro e escuro</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-primary/15">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Idioma do sistema</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Escolha sua lingua de preferencia</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-100">Portugues (BR)</span>
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Notificacoes push</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Alertas de revisao e metas</p>
              </div>
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">Ativo</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-red-300 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/10">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Zona de perigo</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Acoes irreversiveis que afetam permanentemente sua conta.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300">Limpar historico de estudos</button>
            <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Excluir conta permanentemente</button>
          </div>
        </section>

        <section className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5 dark:border-primary/20">
          <input type="hidden" name="targetPercentage" value={target} />
          <input type="hidden" name="theme" value={settings?.theme ?? "system"} />
          <button type="button" className="px-5 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400">Cancelar</button>
          <button type="submit" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-soft">Salvar alteracoes</button>
        </section>
      </form>
    </div>
  );
}
