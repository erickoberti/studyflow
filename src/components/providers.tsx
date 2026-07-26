"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { OfflineSyncBootstrap } from "@/components/offline-sync-bootstrap";
import { PwaConnectionStatus } from "@/components/pwa-connection-status";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <OfflineSyncBootstrap />
        {children}
        <PwaConnectionStatus />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </SessionProvider>
  );
}
