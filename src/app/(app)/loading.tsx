export default function AppLoading() {
  return <div role="status" aria-live="polite" aria-label="Carregando conteúdo" className="animate-pulse space-y-6">
    <div className="h-10 w-56 rounded-xl bg-slate-200 dark:bg-slate-800" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />)}</div>
    <div className="h-80 rounded-3xl bg-slate-200 dark:bg-slate-800" />
    <span className="sr-only">Carregando...</span>
  </div>;
}
