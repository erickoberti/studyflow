import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { getReviewSuggestions } from "@/lib/analytics";

export default async function RevisaoPage() {
  const user = await requireUser();
  const data = await getReviewSuggestions(user.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Revisar urgente (maior erro)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.weak.map((item) => (
            <li key={item.id} className="rounded-lg bg-red-50 px-2 py-1 dark:bg-red-950/20">
              <p className="font-semibold">{item.subject}</p>
              <p className="text-xs text-slate-600">{item.discipline} | {item.percentage.toFixed(1)}%</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sem revisão há mais tempo</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.stale.map((item) => (
            <li key={item.id} className="rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-950/20">
              <p className="font-semibold">{item.subject}</p>
              <p className="text-xs text-slate-600">
                {item.lastStudy
                  ? `Último estudo ${formatDistanceToNow(item.lastStudy, { addSuffix: true, locale: ptBR })}`
                  : "Sem registro"}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vistos recentemente</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.recent.map((item) => (
            <li key={item.id} className="rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-950/20">
              <p className="font-semibold">{item.subject}</p>
              <p className="text-xs text-slate-600">
                {item.lastStudy
                  ? formatDistanceToNow(item.lastStudy, { addSuffix: true, locale: ptBR })
                  : "Sem registro"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
