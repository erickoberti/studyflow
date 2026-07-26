"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { refreshOfflineSnapshotFromServer, syncPendingOfflineSessions } from "@/lib/offline/sync";
import { getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { offlineSessionQueue, subscribeOfflineSessionQueue } from "@/lib/offline/active-session-queue";

export function OfflineSyncBootstrap() {
  const pathname = usePathname();
  const { status } = useSession();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function updatePendingCount() {
      const snapshot = getOfflineSnapshot();
      const activeOperations = snapshot.user?.id && snapshot.activeGuideId ? await offlineSessionQueue.getOperations(snapshot.user.id, snapshot.activeGuideId).catch(() => []) : [];
      setPendingCount(
        snapshot.sessions.filter((session) => session.syncStatus !== "synced").length +
          snapshot.pendingOperations.length + activeOperations.filter((item) => ["PENDING", "FAILED"].includes(item.status)).length,
      );
    }

    updatePendingCount();
    const unsubscribeStore = subscribeOfflineStore(updatePendingCount); const unsubscribeQueue = subscribeOfflineSessionQueue(updatePendingCount);
    return () => { unsubscribeStore(); unsubscribeQueue(); };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    let active = true;

    async function hydrate() {
      try {
        await refreshOfflineSnapshotFromServer();
        if (active && navigator.onLine) {
          await syncPendingOfflineSessions();
        }
      } catch {
        // Keep local cache as the fallback when the server is unavailable.
      }
    }

    hydrate();

    function handleOnline() {
      hydrate();
    }

    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [status, pathname]);

  useEffect(() => {
    if (status !== "authenticated" || pendingCount === 0 || !navigator.onLine) return;
    syncPendingOfflineSessions().catch(() => undefined);
  }, [pendingCount, status]);

  return null;
}
