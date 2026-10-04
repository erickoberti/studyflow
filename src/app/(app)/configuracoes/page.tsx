import shell from "@/components/official-shell.module.css";
import visual from "@/components/resource-screens.module.css";
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
  return `rounded-card border bg-surface p-5 dark:bg-panelDark ${
    danger
      ? "border-red-200 dark:border-red-500/20"
      : "border-slate-200 dark:border-white/5"
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
  const sessionMinutes = settings?.sessionMinutes ?? 60;
  const questionsPerSession = settings?.questionsPerSession ?? 20;
  const examDate = settings?.examDate ? settings.examDate.toISOString().slice(0, 10) : "";

  return (
    <div className={`${shell.screen} ${visual.page} ${visual.settings} space-y-5`}>
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Configurações</h1>
          <p className="text-sm text-textSecondary dark:text-textSecondary">
            Ajustes essenciais da conta e do seu ritmo de estudo em uma tela mais enxuta.
          </p>
        </div>
      </header>

      <form action={updateSettings} className="space-y-5">
        <section className={infoCardClassName()}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="settings-avatar flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserCircle2 className="h-10 w-10" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{user.name ?? "Usuário"}</p>
                <p className="text-sm text-textSecondary dark:text-textSecondary">{user.email}</p>
                <div className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {guide.name}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-white/10 dark:bg-elevated/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-textSecondary">Meta diária</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{dailyGoal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-white/10 dark:bg-elevated/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-textSecondary">Meta semanal</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{weeklyGoal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-white/10 dark:bg-elevated/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-textSecondary">Meta %</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{target.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <article className={infoCardClassName()}>
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Preferências de estudo</h2>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-elevated/60">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarRange className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-slate-900 dark:text-white">Data da prova</p><p className="text-xs text-textSecondary dark:text-textSecondary">Base do planejamento até o edital</p></div></div>
                <input name="examDate" type="date" defaultValue={examDate} className="h-11 rounded-xl border border-slate-300 bg-surface px-3 text-sm font-semibold outline-none focus:border-primary dark:border-slate-600 dark:bg-elevated" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-elevated/60"><span className="text-xs font-bold text-textSecondary">Minutos/sessão</span><input name="sessionMinutes" type="number" min={1} defaultValue={sessionMinutes} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 text-center text-sm font-semibold dark:border-slate-600 dark:bg-elevated" /></label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-elevated/60"><span className="text-xs font-bold text-textSecondary">Questões/sessão</span><input name="questionsPerSession" type="number" min={1} defaultValue={questionsPerSession} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 text-center text-sm font-semibold dark:border-slate-600 dark:bg-elevated" /></label>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-elevated/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Meta diária</p>
                    <p className="text-xs text-textSecondary dark:text-textSecondary">Questões por dia</p>
                  </div>
                </div>
                <input
                  name="dailyQuestionsGoal"
                  type="number"
                  min={1}
                  defaultValue={dailyGoal}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-surface px-3 text-center text-sm font-semibold outline-none focus:border-primary dark:border-slate-600 dark:bg-elevated"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-elevated/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarRange className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Meta semanal</p>
                    <p className="text-xs text-textSecondary dark:text-textSecondary">Volume total da semana</p>
                  </div>
                </div>
                <input
                  name="weeklyQuestionsGoal"
                  type="number"
                  min={1}
                  defaultValue={weeklyGoal}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-surface px-3 text-center text-sm font-semibold outline-none focus:border-primary dark:border-slate-600 dark:bg-elevated"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-elevated/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Flame className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Meta de acerto</p>
                    <p className="text-xs text-textSecondary dark:text-textSecondary">Percentual ideal de desempenho</p>
                  </div>
                </div>
                <input
                  name="targetPercentage"
                  type="number"
                  min={1}
                  max={100}
                  step="1"
                  defaultValue={target}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-surface px-3 text-center text-sm font-semibold outline-none focus:border-primary dark:border-slate-600 dark:bg-elevated"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-elevated/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <SlidersHorizontal className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Viés de prioridade</p>
                    <p className="text-xs text-textSecondary dark:text-textSecondary">Peso extra para assuntos mais relevantes</p>
                  </div>
                </div>
                <input
                  name="weightPriorityBias"
                  type="number"
                  step="0.05"
                  defaultValue={bias}
                  className="h-11 w-24 rounded-xl border border-slate-300 bg-surface px-3 text-center text-sm font-semibold outline-none focus:border-primary dark:border-slate-600 dark:bg-elevated"
                />
              </label>
            </div>
          </article>

          <article className={infoCardClassName()}>
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Interface e notificações</h2>
            </div>

            <div className="space-y-3">
              <div className="settings-theme-row flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-elevated/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MoonStar className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Modo de tema</p>
                    <p className="text-xs text-textSecondary dark:text-textSecondary">Controle rápido entre claro e escuro</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>

              <input type="hidden" name="theme" value={themeSettings?.theme ?? "system"} />

              {[
                {
                  icon: Mail,
                  title: "E-mails de lembrete",
                  text: "Ainda não disponível",
                  checked: true,
                },
                {
                  icon: Bell,
                  title: "Notificações push",
                  text: "Ainda não disponível",
                  checked: true,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <label
                    key={item.title}
                    className="settings-theme-row flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-elevated/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-xs text-textSecondary dark:text-textSecondary">{item.text}</p>
                      </div>
                    </div>
                    <input type="checkbox" disabled aria-label={`${item.title}: ainda não disponível`} title="Ainda não disponível" className="h-4 w-4 accent-primary" />
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Segurança</h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: LockKeyhole,
                  title: "Alterar senha",
                  text: "Ainda não disponível",
                },
                {
                  icon: ShieldCheck,
                  title: "Autenticação em 2 etapas",
                  text: "Ainda não disponível",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button" disabled title="Ainda não disponível"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/30 dark:border-white/10 dark:bg-elevated/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-xs text-textSecondary dark:text-textSecondary">{item.text}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-textSecondary">›</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="space-y-5">
            <div className={infoCardClassName()}>
              <div className="mb-4 flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Conta</h2>
              </div>

              <button
                type="button" disabled title="Ainda não disponível"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/30 dark:border-white/10 dark:bg-elevated/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Sessões ativas</p>
                    <p className="text-xs text-textSecondary dark:text-textSecondary">Ainda não disponível</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-textSecondary">›</span>
              </button>
            </div>

            <div className={infoCardClassName(true)}>
              <div className="mb-4 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Zona de perigo</h2>
              </div>
              <p className="text-sm text-textSecondary dark:text-textSecondary">
                Excluir sua conta remove dados de estudo, guias e histórico de forma permanente.
              </p>
              <button
                type="button" disabled title="Ainda não disponível"
                className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:border-red-500/30 dark:text-red-300"
              >
                Excluir conta (indisponível)
              </button>
            </div>
          </article>
        </section>

        <section className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5 dark:border-white/5">
          <button
            type="reset"
            className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-textSecondary dark:border-white/10 dark:text-textSecondary"
          >
            Desfazer alterações
          </button>
          <button type="submit" className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-white shadow-soft">
            Salvar alterações
          </button>
        </section>
      </form>
    </div>
  );
}
