"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  History,
  LayoutDashboard,
  RefreshCcw,
  Settings,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/registro", label: "Registrar Estudo", icon: BookOpenCheck },
  { href: "/ciclo", label: "Ciclo de Estudos", icon: RefreshCcw },
  { href: "/base", label: "Cadastro-base", icon: BookOpen },
  { href: "/estatisticas", label: "Desempenho", icon: BarChart3 },
  { href: "/revisao", label: "Revisao", icon: History },
];

const mobileLinks = [
  links[0],
  links[1],
  links[2],
  links[4],
  links[5],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-backgroundLight text-slate-900 dark:bg-backgroundDark dark:text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1700px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-primary/15 bg-[#100c1d] lg:flex lg:flex-col">
          <div className="p-7">
            <div className="mb-9 flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-white shadow-soft">
                <Sparkles size={20} />
              </div>
              <div>
                <h1 className="text-3xl leading-none font-extrabold tracking-tight text-white">StudyFlow</h1>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-primarySoft">Plataforma de Estudos</p>
              </div>
            </div>

            <nav className="space-y-2">
              {links.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors",
                      active
                        ? "bg-primary/20 text-primarySoft"
                        : "text-slate-300 hover:bg-primary/10 hover:text-white",
                    )}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-primary/15 p-6">
            <Link
              href="/configuracoes"
              className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-slate-300 transition hover:bg-primary/10 hover:text-white"
            >
              <Settings size={18} /> Configuracoes
            </Link>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/30 text-primarySoft">
                <UserCircle2 size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{session?.user?.name ?? "Usuario"}</p>
                <p className="text-xs text-slate-400">{session?.user?.email ?? "-"}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-primary/15 bg-backgroundLight/90 px-4 py-3 backdrop-blur md:px-8 dark:bg-backgroundDark/80">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-extrabold">StudyFlow</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-primary">Estudos</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden rounded-xl border border-primary/20 bg-[#1d1732] px-3 py-1.5 md:block">
                <p className="text-xs font-semibold text-white">{session?.user?.name ?? "Usuario"}</p>
                <p className="text-[10px] text-slate-400">{session?.user?.email ?? "-"}</p>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-primary/20 bg-[#120e20]/95 p-1 backdrop-blur lg:hidden">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold",
                active ? "bg-primary/20 text-primarySoft" : "text-slate-400",
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
