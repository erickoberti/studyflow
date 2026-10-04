export default function AppLoading() {
  return <div role="status" aria-live="polite" aria-label="Carregando conteúdo" className="animate-pulse space-y-6">
    <div className="h-10 w-56 rounded-xl bg-elevated" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-elevated" />)}</div>
    <div className="h-80 rounded-3xl bg-elevated" />
    <span className="sr-only">Carregando...</span>
  </div>;
}
