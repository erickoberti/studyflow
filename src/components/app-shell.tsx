"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { clearOfflineAccess } from "@/lib/offline/store";
import {
  ChevronDown,
  BookOpen,
  BookOpenCheck,
  LayoutDashboard,
  ListChecks,
  Menu,
  LogOut,
  RefreshCcw,
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
  { href: "/registro", label: "Estudar", icon: BookOpenCheck },
  { href: "/ciclo", label: "Ciclo", icon: RefreshCcw },
  { href: "/base", label: "Disciplinas", icon: BookOpen },
  { href: "/registros", label: "Histórico", icon: ListChecks },
  { href: "/revisao", label: "Revisões", icon: RefreshCcw },
  { href: "/mais", label: "Mais recursos", icon: Menu },
];

const mobileLinks = links.slice(0, 5);

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
      clearOfflineAccess();
      router.replace("/auth/login?mode=web");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-backgroundLight text-textPrimary dark:bg-backgroundDark">
      <a href="#main-content" className="sr-only z-[200] rounded-control bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Pular para o conteúdo</a>
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r bg-surface lg:flex lg:flex-col">
          <div className="px-6 py-7">
            <div className="mb-8 flex items-center gap-3"><BrandLogo className="h-9 w-9 rounded-control object-cover" /><div><p className="text-lg font-bold tracking-tight">StudyFlow</p><p className="text-[9px] font-semibold uppercase tracking-wider text-textSecondary">{["/base", "/registros", "/revisao", "/ciclo", "/dashboard", "/registro"].includes(pathname) ? "Focus OS" : "Plataforma de estudos"}</p></div></div>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-textSecondary">Plataforma</p>
            <nav className="space-y-1" aria-label="Navegação principal">
              {links.map((item) => { const Icon = item.icon; const active = isActivePath(pathname, item.href) || (item.href === "/mais" && !links.slice(0, 6).some((link) => isActivePath(pathname, link.href))); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-control px-3 text-sm transition-colors", active ? "bg-navigation font-semibold text-white" : "text-textSecondary hover:bg-elevated hover:text-textPrimary")}><Icon size={17} />{item.label}</Link>; })}
            </nav>
          </div>
          <div className="mt-auto border-t p-5"><div className="flex items-center gap-3 rounded-control bg-elevated p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-primary text-white"><UserCircle2 size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{userName}</p><p className="truncate text-[10px] text-textSecondary">{userEmail}</p></div><button type="button" onClick={handleSignOut} aria-label="Sair" title="Sair" className="grid w-11 shrink-0 place-items-center rounded-control text-textSecondary hover:text-primary"><LogOut size={16} /></button></div></div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-40 border-b bg-backgroundLight/95 px-4 backdrop-blur-md dark:bg-backgroundDark/95 md:px-8">
            <div className="flex h-16 min-w-0 items-center gap-2 sm:gap-3">
              <BrandLogo className="h-8 w-8 shrink-0 rounded-control object-cover lg:hidden" />
              {currentGuide ? <details className="relative min-w-0 flex-1 sm:flex-none">
                <summary aria-label={"Guia ativo: " + currentGuide.name + ". Selecionar guia"} className="flex min-w-0 list-none cursor-pointer items-center justify-center gap-2 rounded-control bg-elevated px-2 text-xs font-medium sm:px-3">
                  <StudyGuideIcon icon={currentGuide.icon} className="hidden h-4 w-4 shrink-0 text-primary sm:block" /><span className="max-w-[130px] truncate sm:max-w-[230px]">{currentGuide.name}</span><ChevronDown size={13} className="shrink-0" />
                </summary>
                <div className="absolute left-0 z-20 mt-2 w-[min(300px,calc(100vw-80px))] rounded-card border bg-surface p-2 shadow-lg">{guideOptions.map((guide) => <form key={guide.id} action={selectStudyGuideAction}><input type="hidden" name="studyGuideId" value={guide.id} /><button className={cn("flex w-full items-center gap-3 rounded-control px-3 text-left text-sm",guide.id === currentGuide.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-elevated")}><StudyGuideIcon icon={guide.icon} className="h-4 w-4 shrink-0" /><span className="truncate">{guide.name}</span></button></form>)}<Link href="/guias" className="sf-secondary mt-2 w-full">Gerenciar guias</Link></div>
              </details> : null}
              <div id="connection-status-slot" className="shrink-0" />
              {pathname === "/registro" ? <Link href="/registros" className="inline-flex min-h-9 shrink-0 items-center rounded-control border px-3 text-xs font-medium">Ver sessões</Link> : null}
              <div className="ml-auto hidden sm:block"><ThemeToggle /></div>
              <Link href="/mais" aria-label="Mais recursos" className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-elevated text-primary sm:ml-0 lg:hidden"><UserCircle2 size={18} /></Link>
              <Link href="/configuracoes" aria-label="Configurações" className="hidden h-11 w-11 place-items-center rounded-control bg-elevated text-textSecondary hover:text-primary sm:grid"><Settings size={17} /></Link>
            </div>
          </header>
          <div id="connection-banner-slot" />
          <main id="main-content" tabIndex={-1} className="sf-content mx-auto w-full max-w-[1104px] flex-1 px-4 py-4 pb-24 outline-none md:px-8 md:py-5 lg:pb-6">{children}</main>
        </div>
      </div>
      <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">{mobileLinks.map((item) => { const Icon=item.icon; const active=isActivePath(pathname,item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px]",active ? "font-semibold text-primary after:absolute after:bottom-2 after:h-0.5 after:w-5 after:rounded-full after:bg-primary" : "text-textSecondary")}><Icon size={19} /><span className="truncate">{item.label}</span></Link>; })}</nav>
    </div>
  );
}

