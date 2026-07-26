"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, Cloud, Download, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { offlineSessionQueue, subscribeOfflineSessionQueue, type OfflineSessionOperation } from "@/lib/offline/active-session-queue";
import { getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { getSyncRuntimeState, subscribeSyncRuntime, syncPendingOfflineSessions, type SyncRuntimeState } from "@/lib/offline/sync";
import { cn } from "@/lib/cn";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaConnectionStatus() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [runtime, setRuntime] = useState<SyncRuntimeState>(getSyncRuntimeState());
  const [operations, setOperations] = useState<OfflineSessionOperation[]>([]);
  const [legacyPending, setLegacyPending] = useState(0);
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const reloading = useRef(false);

  const refreshOperations = useCallback(async () => {
    const snapshot = getOfflineSnapshot();
    setLegacyPending(snapshot.pendingOperations.length + snapshot.sessions.filter((item) => item.syncStatus !== "synced").length);
    if (!snapshot.user?.id) return setOperations([]);
    const guideIds = [...new Set(snapshot.guides.map((guide) => guide.serverId ?? guide.id))];
    const values = await Promise.all(guideIds.map((guideId) => offlineSessionQueue.getOperations(snapshot.user!.id, guideId).catch(() => [])));
    setOperations(values.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine); refreshOperations();
    const onlineHandler = () => setOnline(navigator.onLine);
    const promptHandler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("online", onlineHandler); window.addEventListener("offline", onlineHandler); window.addEventListener("beforeinstallprompt", promptHandler);
    const unsubscribeStore = subscribeOfflineStore(refreshOperations); const unsubscribeQueue = subscribeOfflineSessionQueue(refreshOperations); const unsubscribeRuntime = subscribeSyncRuntime(setRuntime);
    return () => { window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", onlineHandler); window.removeEventListener("beforeinstallprompt", promptHandler); unsubscribeStore(); unsubscribeQueue(); unsubscribeRuntime(); };
  }, [refreshOperations]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const update = () => navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
    const controllerChange = () => { if (!reloading.current) { reloading.current = true; window.location.reload(); } };
    update(); const interval = window.setInterval(update, 60 * 60 * 1000); window.addEventListener("focus", update); window.addEventListener("online", update); navigator.serviceWorker.addEventListener("controllerchange", controllerChange);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", update); window.removeEventListener("online", update); navigator.serviceWorker.removeEventListener("controllerchange", controllerChange); };
  }, []);

  const conflicts = useMemo(() => operations.filter((item) => item.status === "CONFLICT"), [operations]);
  const failures = useMemo(() => operations.filter((item) => item.status === "FAILED"), [operations]);
  const pending = useMemo(() => operations.filter((item) => ["PENDING", "SYNCING"].includes(item.status)), [operations]);
  const pendingCount = legacyPending + pending.length + failures.length + conflicts.length;
  const visual = !online ? { label: "Offline", icon: WifiOff, style: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200" }
    : runtime === "SYNCING" ? { label: "Sincronizando", icon: RefreshCw, style: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200" }
    : conflicts.length ? { label: `${conflicts.length} conflito${conflicts.length > 1 ? "s" : ""}`, icon: AlertTriangle, style: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200" }
    : failures.length || runtime === "ERROR" ? { label: "Erro de sincronização", icon: AlertTriangle, style: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200" }
    : pendingCount ? { label: `${pendingCount} pendência${pendingCount > 1 ? "s" : ""}`, icon: Cloud, style: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200" }
    : { label: "Online", icon: Wifi, style: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200" };
  const StatusIcon = visual.icon;

  async function install() { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }
  async function retry(operationId: string) { await offlineSessionQueue.updateOperation(operationId, { status: "PENDING", lastError: null }); if (navigator.onLine) await syncPendingOfflineSessions().catch(() => undefined); }
  async function dismiss(operationId: string) { const target = operations.find((item) => item.operationId === operationId); await offlineSessionQueue.updateOperation(operationId, { status: "CANCELLED" }); if (target) { const remaining = (await offlineSessionQueue.getOperations(target.userId, target.studyGuideId)).some((item) => item.operationId !== operationId && item.payload.localSessionId === target.payload.localSessionId && ["PENDING", "SYNCING", "FAILED", "CONFLICT"].includes(item.status)); const session = await offlineSessionQueue.getSession(target.userId, target.studyGuideId); if (session?.localSessionId === target.payload.localSessionId && !remaining) await offlineSessionQueue.putSession({ ...session, pendingSync: false, updatedAt: new Date().toISOString() }); } }

  if (pathname.startsWith("/auth/")) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Estado da conexão: ${visual.label}`} className={cn("fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[80] inline-flex min-h-11 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border px-4 py-2 text-xs font-black shadow-lg backdrop-blur sm:left-auto sm:right-4", visual.style)}>
      <StatusIcon size={15} className={runtime === "SYNCING" ? "animate-spin" : ""} /><span className="truncate">{visual.label}</span>
    </button>
    {open ? <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Sincronização e conflitos">
      <section className="max-h-[82dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-950 sm:max-w-lg sm:rounded-3xl sm:p-6">
        <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Conexão e sincronização</p><h2 className="mt-1 text-2xl font-black">{visual.label}</h2><p className="mt-1 text-sm text-slate-500">Os dados confirmados no servidor nunca são substituídos silenciosamente.</p></div><button type="button" onClick={() => setOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-xl border" aria-label="Fechar"><X size={18} /></button></header>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center"><Summary label="Pendentes" value={pending.length + legacyPending} /><Summary label="Erros" value={failures.length} /><Summary label="Conflitos" value={conflicts.length} /></div>
        {installPrompt ? <button type="button" onClick={install} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-black text-white"><Download size={17} /> Instalar StudyFlow</button> : null}
        <div className="mt-5 space-y-3">{operations.filter((item) => ["CONFLICT", "FAILED", "PENDING", "SYNCING"].includes(item.status)).map((item) => <article key={item.operationId} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{operationLabel(item.type)}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("pt-BR")} · tentativa {item.attempts}</p></div><StatePill status={item.status} /></div>{item.lastError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{item.lastError}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{item.status === "FAILED" ? <button type="button" onClick={() => retry(item.operationId)} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-white">Tentar novamente</button> : null}{item.status === "CONFLICT" ? <button type="button" onClick={() => dismiss(item.operationId)} className="rounded-lg border px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-200">Manter servidor e arquivar local</button> : null}</div></article>)}
          {!pendingCount ? <div className="rounded-2xl bg-emerald-50 p-5 text-center text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 className="mx-auto" /><p className="mt-2 font-black">Tudo sincronizado</p></div> : null}
        </div>
      </section>
    </div> : null}
  </>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900"><p className="text-xl font-black">{value}</p><p className="text-[11px] text-slate-500">{label}</p></div>; }
function operationLabel(type: OfflineSessionOperation["type"]) { return ({ START_SESSION: "Início de sessão", PAUSE_SESSION: "Pausa", RESUME_SESSION: "Retomada", FINISH_SESSION: "Finalização", CANCEL_SESSION: "Cancelamento", CREATE_STANDALONE_SESSION: "Estudo avulso" })[type]; }
function StatePill({ status }: { status: OfflineSessionOperation["status"] }) { const labels = { PENDING: "Pendente", SYNCING: "Sincronizando", COMPLETED: "Concluída", FAILED: "Erro", CONFLICT: "Conflito", CANCELLED: "Arquivada" }; return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide dark:bg-slate-800">{labels[status]}</span>; }
