import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <article
      className={cn(
        "rounded-card border p-4 shadow-soft",
        tone === "danger" && "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20",
        tone === "success" && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20",
        tone === "default" && "border-slate-200 bg-surface dark:border-white/5 dark:bg-elevated",
      )}
    >
      <p className="text-xs uppercase tracking-[0.12em] text-textSecondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink dark:text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-textSecondary">{detail}</p> : null}
    </article>
  );
}

