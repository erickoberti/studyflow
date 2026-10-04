"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body className="grid min-h-screen place-items-center bg-slate-950 p-5 text-white"><main className="max-w-md rounded-3xl border border-white/15 bg-surface/5 p-8 text-center"><h1 className="text-2xl font-semibold">StudyFlow encontrou um erro</h1><p className="mt-3 text-sm text-slate-300">Recarregue a interface para continuar. Nenhuma ação incompleta será confirmada duas vezes.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-violet-600 px-5 font-semibold">Recarregar</button></main></body></html>;
}
