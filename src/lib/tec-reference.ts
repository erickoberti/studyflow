import { referenceUrl, safeStudyUrl } from "./study-insights";

const confirmed = "TecConcursos · classificação confirmada por você";
const suggested = "TecConcursos · classificação sugerida";

// Human-readable, backward-compatible storage in the existing tecReference field.
// Old free text is never rewritten on read and is always treated as suggested.
export function parseTecReference(value: string | null | undefined) {
  const lines = (value ?? "").split("\n");
  const structured = lines[0] === confirmed || lines[0] === suggested;
  const topic = structured ? lines.slice(1).filter(line => !line.startsWith("Caderno: ")).join("\n") : value ?? "";
  const url = structured ? safeStudyUrl(lines.find(line => line.startsWith("Caderno: "))?.slice(9)) : referenceUrl(value);
  return { topic, url, status: structured && lines[0] === confirmed ? "CONFIRMED" as const : "SUGGESTED" as const };
}

export function formatTecReference(topic: string, url: string, status: string) {
  const name = topic.trim();
  const link = url.trim();
  if (link && !safeStudyUrl(link)) throw new Error("Informe um link HTTP ou HTTPS válido para o caderno.");
  if (!name && !link) return null;
  return [status === "CONFIRMED" ? confirmed : suggested, name, link ? `Caderno: ${link}` : ""].filter(Boolean).join("\n");
}
