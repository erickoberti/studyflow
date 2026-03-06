"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  BookOpenCheck,
  ChartNoAxesCombined,
  Database,
  Gauge,
  RefreshCcw,
  Settings,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/registro", label: "Registro", icon: BookOpenCheck },
  { href: "/ciclo", label: "Ciclo", icon: RefreshCcw },
  { href: "/base", label: "Cadastro-base", icon: Database },
  { href: "/estatisticas", label: "Estatísticas", icon: ChartNoAxesCombined },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/revisao", label: "Revisão", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen overflow-x-hidden bg-base pb-20 text-slate-900 dark:bg-[#101622] dark:text-slate-100 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1152d4] text-white shadow-lg shadow-blue-500/25">
                <RefreshCcw size={18} />
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight">StudyFlow</p>
                <p className="text-[11px] text-slate-500">Gestão de Estudos</p>
              </div>
            </div>
            <nav className="hidden items-center gap-6 md:flex">
              {links.slice(0, 5).map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "border-b-2 pb-1 text-sm font-semibold transition-colors",
                      active
                        ? "border-[#1152d4] text-[#1152d4]"
                        : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex dark:border-slate-700 dark:bg-slate-800">
              <UserCircle2 size={16} className="text-slate-500" />
              <div className="leading-tight">
                <p className="text-xs font-bold">{session?.user?.name ?? "Usuário"}</p>
                <p className="text-[10px] text-slate-500">{session?.user?.email ?? "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 py-5 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:block dark:border-slate-800 dark:bg-slate-900">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Navegação</p>
          <nav className="space-y-1.5">
            {links.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-[#1152d4] text-white shadow-lg shadow-blue-600/25"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        {links.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-semibold",
                active ? "text-[#1152d4]" : "text-slate-500 dark:text-slate-400",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}