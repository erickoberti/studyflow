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
    <div className="space-y-8 pb-12">
      <header>
        <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white">Configurações</h1>
        <p className="mt-1 text-xl text-slate-500 dark:text-slate-400">Gerencie sua conta e preferências da plataforma.</p>
      </header>

      <form action={updateSettings} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Perfil do Usuário</h2>
            <p className="text-sm text-slate-500">Suas informações e plano atual</p>
          </div>
          <div className="p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-primary/20" />
                <div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{user.name ?? "Usuário"}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                  <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Plano Premium</span>
                </div>
              </div>
              <button type="button" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800">
                Editar Perfil
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">Preferências</h3>
              <p className="text-sm text-slate-500">Personalize sua experiência</p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Meta diária
                <input name="dailyQuestionsGoal" type="number" min={1} defaultValue={dailyGoal} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Meta semanal
                <input name="weeklyQuestionsGoal" type="number" min={1} defaultValue={weeklyGoal} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Viés de prioridade
                <input name="weightPriorityBias" type="number" step="0.05" defaultValue={bias} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold">Tema</p>
                  <p className="text-xs text-slate-500">Claro / Escuro</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">Notificações</h3>
              <p className="text-sm text-slate-500">Como você quer ser avisado</p>
            </div>
            <div className="space-y-4 p-5">
              {[
                ["Notificações por E-mail", "Resumos e alertas de desempenho", true],
                ["Notificações Push", "Alertas em tempo real", true],
                ["Lembretes de Estudo", "Lembretes de revisão", true],
                ["Atualizações de Conteúdo", "Novos conteúdos", false],
              ].map(([title, text, checked]) => (
                <label key={String(title)} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-slate-500">{text}</p>
                  </div>
                  <input type="checkbox" defaultChecked={Boolean(checked)} className="h-4 w-4 accent-primary" />
                </label>
              ))}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-panelDark">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">Segurança</h3>
            <p className="text-sm text-slate-500">Proteja sua conta e dados</p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold">Senha</p>
                <p className="text-xs text-slate-500">Última alteração há 3 meses</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">Alterar Senha</button>
            </div>
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold">Autenticação em Dois Fatores</p>
                <p className="text-xs text-slate-500">Habilitado (SMS final 4421)</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">Configurar 2FA</button>
            </div>
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold">Sessões Ativas</p>
                <p className="text-xs text-slate-500">Você está logado em 3 dispositivos</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">Gerenciar Dispositivos</button>
            </div>
          </div>

          <div className="border-t border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">Zona de Perigo</p>
            <p className="text-xs text-red-500">Excluir sua conta é permanente e irreversível.</p>
            <div className="mt-3">
              <button type="button" className="rounded-lg border border-red-400 px-4 py-2 text-sm font-bold text-red-600 dark:text-red-300">Excluir Conta</button>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <input type="hidden" name="targetPercentage" value={target} />
          <input type="hidden" name="theme" value={settings?.theme ?? "system"} />
          <button type="button" className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
          <button type="submit" className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-white shadow-soft">Salvar Alterações</button>
        </section>
      </form>
    </div>
  );
}



