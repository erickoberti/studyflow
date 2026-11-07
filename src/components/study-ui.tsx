import type { ReactNode } from "react";
import { ExternalLink, BookOpen } from "lucide-react";
import { referenceUrl, safeStudyUrl } from "@/lib/study-insights";
import { parseTecReference } from "@/lib/tec-reference";

export function StudyProgress({ label, value, max = 100, className = "" }: { label: string; value: number; max?: number; className?: string }) {
  const total = Math.max(1, max);
  const current = max > 0 ? Math.max(0, Math.min(total, Number.isFinite(value) ? value : 0)) : 0;
  return <div className={`sf-progress ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}><span style={{ width: `${current / total * 100}%` }} /></div>;
}

export type TecStudyReference = { topic?: string | null; discipline?: string | null; url?: string | null; status?: string; legacy?: string | null };

export function TecReference({ reference, children }: { reference: TecStudyReference; children?: ReactNode }) {
  const legacy = parseTecReference(reference.legacy);
  const url = safeStudyUrl(reference.url) ?? legacy.url ?? referenceUrl(reference.legacy);
  const text = [reference.discipline, reference.topic].filter(Boolean).join(" → ") || legacy.topic;
  const status = reference.status ?? legacy.status;
  if (!text && !url) return null;
  return <div className="sf-tec-reference"><BookOpen size={17} aria-hidden /><div><p><strong>TecConcursos</strong><span className="sf-chip">{status === "CONFIRMED" ? "Confirmado por você" : "Referência sugerida"}</span></p>{text ? <p>{text}</p> : null}{children}</div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="sf-secondary">Abrir caderno <ExternalLink size={15} aria-hidden /><span className="sr-only"> (nova aba)</span></a> : null}</div>;
}
