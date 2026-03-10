"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  History,
  ListChecks,
  LayoutDashboard,
  LogOut,
  RefreshCcw,
  Settings,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/registro", label: "Registrar Estudo", icon: BookOpenCheck },
  { href: "/registros", label: "Sessões", icon: ListChecks },
  { href: "/ciclo", label: "Ciclo de Estudos", icon: RefreshCcw },
  { href: "/base", label: "Cadastro", icon: BookOpen },
  { href: "/estatisticas", label: "Desempenho", icon: BarChart3 },
  { href: "/revisao", label: "Revisão", icon: History },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const topLinks = [links[0], links[3], links[5], links[6]];
const mobileLinks = [links[0], links[1], links[2], links[3], links[5]];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

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
      <div className="mx-auto grid min-h-screen max-w-[1720px] grid-cols-1 lg:grid-cols-[265px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col dark:border-primary/15 dark:bg-[#100c1d]">
          <div className="flex h-full flex-col p-6">
            <div className="mb-7 flex items-center gap-3">
              <BrandLogo className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">STUDYFLOW</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Plataforma de estudos</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {links.slice(0, 7).map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-slate-600 hover:bg-primary/10 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                    )}
                  >
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6">
              <Link
                href="/configuracoes"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  pathname.startsWith("/configuracoes")
                    ? "bg-primary/15 text-primary"
                    : "text-slate-600 hover:bg-primary/10 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                )}
              >
                <Settings size={17} />
                Configurações
              </Link>
            </div>

            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-primary/15 dark:bg-[#161126]">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-primary">
                  <UserCircle2 size={17} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{session?.user?.name ?? "Usuário"}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{session?.user?.email ?? "-"}</p>
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
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-backgroundLight/95 px-4 py-3 backdrop-blur md:px-8 dark:border-primary/15 dark:bg-backgroundDark/90">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 lg:hidden">
                <BrandLogo className="h-8 w-8 rounded-lg object-cover" />
                <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">STUDYFLOW</p>
              </div>

              <nav className="hidden items-center gap-6 lg:flex">
                {topLinks.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "border-b-2 pb-1 text-sm font-semibold transition-colors",
                        active ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-auto flex items-center gap-2">
                <button className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 md:flex dark:border-primary/20 dark:bg-[#1b1530] dark:text-slate-300">
                  <Bell size={16} />
                </button>
                <ThemeToggle />
                <Link
                  href="/configuracoes"
                  className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 md:flex dark:border-primary/20 dark:bg-[#1b1530] dark:text-slate-300"
                >
                  <Settings size={16} />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary md:inline-flex"
                >
                  <LogOut size={14} /> Sair
                </button>
                <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 md:block dark:border-primary/20 dark:bg-[#1d1732]">
                  <p className="max-w-[170px] truncate text-xs font-semibold text-slate-800 dark:text-white">{session?.user?.email ?? "Usuário"}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 md:px-7 md:py-6">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 p-1 backdrop-blur lg:hidden dark:border-primary/20 dark:bg-[#120e20]/95">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
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
