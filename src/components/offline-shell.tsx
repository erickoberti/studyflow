"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Cloud, CloudOff, Database, FolderKanban, LayoutDashboard, ListChecks, LogOut, RefreshCcw, Settings, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { getOfflineAccess, getOfflineSnapshot, clearOfflineAccess, subscribeOfflineStore } from "@/lib/offline/store";
import { syncPendingOfflineSessions } from "@/lib/offline/sync";
import { cn } from "@/lib/cn";
import { offlineSessionQueue, subscribeOfflineSessionQueue } from "@/lib/offline/active-session-queue";

const links = [
  { href: "/offline/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/offline/registro", label: "Registrar", icon: Database },
  { href: "/offline/registros", label: "Sessões", icon: ListChecks },
  { href: "/offline/ciclo", label: "Ciclo", icon: RefreshCcw },
  { href: "/offline/base", label: "Base", icon: Database },
  { href: "/offline/guias", label: "Guias", icon: FolderKanban },
  { href: "/offline/configuracoes", label: "Config", icon: Settings },
];

export function OfflineShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [access, setAccess] = useState(getOfflineAccess());
  const [activePending, setActivePending] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnlineState() {
      setIsOnline(navigator.onLine);
    }

    async function refreshActivePending() { const value = getOfflineSnapshot(); if (!value.user?.id || !value.activeGuideId) return setActivePending(0); const operations = await offlineSessionQueue.getOperations(value.user.id, value.activeGuideId).catch(() => []); setActivePending(operations.filter((item) => ["PENDING", "SYNCING", "FAILED", "CONFLICT"].includes(item.status)).length); }
    refreshActivePending();
    const unsubscribe = subscribeOfflineStore(() => {
      setSnapshot(getOfflineSnapshot());
      setAccess(getOfflineAccess());
      refreshActivePending();
    });
    const unsubscribeQueue = subscribeOfflineSessionQueue(refreshActivePending);

    window.addEventListener("online", handleOnlineState);
    window.addEventListener("offline", handleOnlineState);

    return () => {
      unsubscribe();
      unsubscribeQueue();
      window.removeEventListener("online", handleOnlineState);
      window.removeEventListener("offline", handleOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!access) {
      router.replace("/auth/login?mode=app");
    }
  }, [access, router]);

  async function handleSync() {
    if (!navigator.onLine) return;
    try {
      setSyncing(true);
      setSyncError(null);
      await syncPendingOfflineSessions();
      setSnapshot(getOfflineSnapshot());
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Não foi possível sincronizar agora.");
    } finally {
      setSyncing(false);
    }
  }

  function handleExitOffline() {
    clearOfflineAccess();
    router.replace("/auth/login?mode=app");
  }

  if (!access) return <main role="status" className="grid min-h-screen place-items-center bg-backgroundLight p-5 dark:bg-backgroundDark"><p className="rounded-2xl border bg-white p-5 font-bold dark:bg-slate-950">Validando acesso offline...</p></main>;

  const currentGuide = snapshot.guides.find((guide) => guide.id === snapshot.activeGuideId);
  const pendingCount =
    snapshot.sessions.filter((session) => session.syncStatus !== "synced").length + snapshot.pendingOperations.length + activePending;

  return (
    <div className="min-h-screen bg-backgroundLight text-slate-900 dark:bg-backgroundDark dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-6">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">StudyFlow Offline</p>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                {currentGuide?.name ?? "Dados locais"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {access?.name ?? snapshot.user?.name ?? "Aluno"} | {snapshot.lastSyncedAt ? `Ultima sincronizacao: ${new Date(snapshot.lastSyncedAt).toLocaleString("pt-BR")}` : "Sem sincronizacao recente"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold",
                  isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}
              >
                {isOnline ? <Wifi size={14} /> : <CloudOff size={14} />}
                {isOnline ? "Online" : "Offline"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Cloud size={14} />
                {pendingCount} pendente(s)
              </span>
              <button
                type="button"
                onClick={handleSync}
                disabled={!isOnline || syncing}
                className="rounded-full bg-primary px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {syncing ? "Sincronizando..." : "Sincronizar"}
              </button>
              <Link href="/dashboard" className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-black text-primary">
                Abrir online
              </Link>
              <button
                type="button"
                onClick={handleExitOffline}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                <LogOut size={14} />
                Sair offline
              </button>
            </div>
          </div>

          {syncError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{syncError}</p> : null}
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegação offline">
            {links.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold",
                    active
                      ? "bg-primary text-white"
                      : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                  )}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
