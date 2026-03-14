import {
  Bell,
  CalendarRange,
  Flame,
  LockKeyhole,
  Mail,
  MoonStar,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { updateSettings } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { getStudyGuideSettings } from "@/lib/study-guide-settings";

function infoCardClassName(danger = false) {
  return `rounded-[22px] border bg-white p-5 shadow-sm dark:bg-panelDark ${
    danger
      ? "border-red-200 dark:border-red-500/20"
      : "border-slate-200 dark:border-slate-800"
  }`;
}

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const [themeSettings, settings] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    getStudyGuideSettings(user.id, guide.id),
  ]);

  const dailyGoal = settings?.dailyQuestionsGoal ?? 30;
  const weeklyGoal = settings?.weeklyQuestionsGoal ?? 200;
  const target = settings?.targetPercentage ?? 80;
  const bias = settings?.weightPriorityBias ?? 1.25;

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Configuracoes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ajustes essenciais da conta e do seu ritmo de estudo em uma tela mais enxuta.
          </p>
        </div>
      </header>

      <form action={updateSettings} className="space-y-5">
        <section className={infoCardClassName()}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserCircle2 className="h-10 w-10" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{user.name ?? "Usuario"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary">
                  Plano Premium
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Meta diaria</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{dailyGoal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Meta semanal</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{weeklyGoal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Meta %</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{target.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <article className={infoCardClassName()}>
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Preferencias de estudo</h2>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Meta diaria</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Questoes por dia</p>
                  </div>
                </div>
                <input
                  name="dailyQuestionsGoal"
                  type="number"
                  min={1}
                  defaultValue={dailyGoal}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm font-black outline-none focus:border-primary dark:border-slate-600 dark:bg-[#120e20]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarRange className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Meta semanal</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Volume total da semana</p>
                  </div>
                </div>
                <input
                  name="weeklyQuestionsGoal"
                  type="number"
                  min={1}
                  defaultValue={weeklyGoal}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm font-black outline-none focus:border-primary dark:border-slate-600 dark:bg-[#120e20]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Flame className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Meta de acerto</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Percentual ideal de desempenho</p>
                  </div>
                </div>
                <input
                  name="targetPercentage"
                  type="number"
                  min={1}
                  max={100}
                  step="1"
                  defaultValue={target}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm font-black outline-none focus:border-primary dark:border-slate-600 dark:bg-[#120e20]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <SlidersHorizontal className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Viés de prioridade</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Peso extra para assuntos mais relevantes</p>
                  </div>
                </div>
                <input
                  name="weightPriorityBias"
                  type="number"
                  step="0.05"
                  defaultValue={bias}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm font-black outline-none focus:border-primary dark:border-slate-600 dark:bg-[#120e20]"
                />
              </label>
            </div>
          </article>

          <article className={infoCardClassName()}>
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Interface e notificacoes</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MoonStar className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Modo de tema</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Controle rapido entre claro e escuro</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>

              <input type="hidden" name="theme" value={themeSettings?.theme ?? "system"} />

              {[
                {
                  icon: Mail,
                  title: "Emails de lembrete",
                  text: "Resumo e notificacoes por email",
                  checked: true,
                },
                {
                  icon: Bell,
                  title: "Notificacoes push",
                  text: "Alertas no navegador",
                  checked: true,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <label
                    key={item.title}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.text}</p>
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked={item.checked} className="h-4 w-4 accent-primary" />
                  </label>
                );
              })}
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className={infoCardClassName()}>
            <div className="mb-4 flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Seguranca</h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: LockKeyhole,
                  title: "Alterar senha",
                  text: "Ultima alteracao ha 3 meses",
                },
                {
                  icon: ShieldCheck,
                  title: "Autenticacao em 2 etapas",
                  text: "Ativado via app",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/30 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.text}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-400">›</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="space-y-5">
            <div className={infoCardClassName()}>
              <div className="mb-4 flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Conta</h2>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/30 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Sessoes ativas</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Gerencie dispositivos conectados</p>
                  </div>
                </div>
                <span className="text-sm font-black text-slate-400">›</span>
              </button>
            </div>

            <div className={infoCardClassName(true)}>
              <div className="mb-4 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Zona de perigo</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Excluir sua conta remove dados de estudo, guias e historico de forma permanente.
              </p>
              <button
                type="button"
                className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-black text-red-600 dark:border-red-500/30 dark:text-red-300"
              >
                Excluir conta
              </button>
            </div>
          </article>
        </section>

        <section className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            Cancelar
          </button>
          <button type="submit" className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-white shadow-soft">
            Salvar alteracoes
          </button>
        </section>
      </form>
    </div>
  );
}
