export default function DashboardLoading() {
  return <div role="status" aria-label="Carregando painel" className="animate-pulse space-y-8 py-4">
    <div className="h-7 w-72 max-w-full rounded-control bg-elevated" />
    <div className="h-16 w-3/4 rounded-control bg-elevated" />
    <div className="h-10 w-2/3 rounded-control bg-elevated" />
    <div className="h-[440px] rounded-card border bg-surface" />
    <div className="h-12 rounded-control bg-elevated" />
    <span className="sr-only">Carregando painel...</span>
  </div>;
}
