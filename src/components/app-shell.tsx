"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  BookOpen,
  BookOpenCheck,
  FolderKanban,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  RefreshCcw,
  Search,
  Settings,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { StudyGuideIcon } from "@/components/study-guide-icon";
import { selectStudyGuideAction } from "@/app/actions";

const links = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/registro", label: "Registrar Estudo", icon: BookOpenCheck },
  { href: "/registros", label: "Sessões", icon: ListChecks },
  { href: "/ciclo", label: "Ciclo", icon: RefreshCcw },
  { href: "/base", label: "Disciplinas", icon: BookOpen },
  { href: "/guias", label: "Guias", icon: FolderKanban },
  { href: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { href: "/revisao", label: "Revisão", icon: History },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const topNav = [
  { href: "/dashboard", label: "Painel" },
  { href: "/ciclo", label: "Ciclo" },
  { href: "/base", label: "Matérias" },
  { href: "/estatisticas", label: "Relatórios" },
];

const mobileLinks = [links[0], links[1], links[3], links[5], links[8]];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  currentGuide,
  guideOptions = [],
  currentUser,
}: {
  children: React.ReactNode;
  currentGuide?: { id: string; name: string; icon: string; color: string };
  guideOptions?: Array<{ id: string; name: string; icon: string; color: string }>;
  currentUser?: { name?: string | null; email?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? currentUser?.name ?? "Usuário";
  const userEmail = session?.user?.email ?? currentUser?.email ?? "-";

  async function handleSignOut() {
    try {
      await signOut({ redirect: false });
    } finally {
      router.replace("/auth/login?mode=web");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-backgroundLight text-slate-900 dark:bg-backgroundDark dark:text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1700px] grid-cols-1 lg:grid-cols-[275px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-backgroundDark lg:flex lg:flex-col">
          <div className="p-6">
            <div className="mb-8 flex items-center gap-3">
              <BrandLogo className="h-10 w-10 rounded-xl object-cover" />
              <span className="text-3xl font-black tracking-tight">StudyFlow</span>
            </div>

            <nav className="space-y-1">
              {links.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70",
                    )}
                  >
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-slate-200 p-6 dark:border-slate-800">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserCircle2 size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{userName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-backgroundDark/90 md:px-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <BrandLogo className="h-8 w-8 rounded-lg object-cover" />
                <span className="text-lg font-black">StudyFlow</span>
              </div>

              <nav className="hidden items-center gap-8 lg:flex">
                {topNav.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "border-b-2 pb-1 text-sm font-semibold transition-colors",
                        active ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <label className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex dark:border-slate-700 dark:bg-slate-900/60">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar tópicos, aulas ou materiais..."
                  className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </label>

              <div className="ml-auto flex items-center gap-2">
                {currentGuide ? (
                  <details className="relative hidden lg:block">
                    <summary className="flex list-none cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${currentGuide.color}22`, color: currentGuide.color }}
                      >
                        <StudyGuideIcon icon={currentGuide.icon} className="h-3.5 w-3.5" />
                      </span>
                      <span className="max-w-[180px] truncate">{currentGuide.name}</span>
                      <ChevronDown size={14} />
                    </summary>

                    <div className="absolute right-0 z-20 mt-3 w-[300px] rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-[#151225]">
                      <div className="space-y-2">
                        {guideOptions.map((guide) => (
                          <form key={guide.id} action={selectStudyGuideAction}>
                            <input type="hidden" name="studyGuideId" value={guide.id} />
                            <button
                              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                                guide.id === currentGuide.id
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                              }`}
                            >
                              <span
                                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                style={{ backgroundColor: `${guide.color}22`, color: guide.color }}
                              >
                                <StudyGuideIcon icon={guide.icon} className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-black">{guide.name}</span>
                            </button>
                          </form>
                        ))}
                        <Link
                          href="/guias"
                          className="mt-2 flex w-full items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary"
                        >
                          Gerenciar guias
                        </Link>
                      </div>
                    </div>
                  </details>
                ) : null}
                <button className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Bell size={16} />
                </button>
                <ThemeToggle />
                <Link href="/configuracoes" className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Settings size={16} />
                </Link>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{userName}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary md:inline-flex"
                >
                  <LogOut size={14} /> Sair
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 p-1 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-backgroundDark/95">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold",
                active ? "bg-primary/15 text-primary" : "text-slate-500 dark:text-slate-400",
              )}
            >
              <Icon size={16} />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}


