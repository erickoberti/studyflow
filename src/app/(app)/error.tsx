"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }) }).catch(() => undefined);
  }, [error]);
  return <section role="alert" className="mx-auto max-w-xl rounded-3xl border border-rose-300 bg-rose-50 p-7 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
    <AlertTriangle size={32} /><h1 className="mt-4 text-2xl font-black">Não foi possível carregar esta área</h1><p className="mt-2 text-sm leading-6">O erro foi registrado. Tente novamente; seus dados existentes não foram alterados.</p>
    <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 font-black text-white"><RotateCcw size={16} /> Tentar novamente</button>
  </section>;
}
