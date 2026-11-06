import { z } from "zod";

export const PROGRAM_POSITIONS = 16;
export const PROGRAM_ROUNDS = 4;
export const tecSchema = z.object({
  tecDiscipline: z.string().trim().max(300).default(""),
  tecTopic: z.string().trim().max(500).default(""),
  tecUrl: z.string().trim().max(2000).refine(value => !value || /^https?:\/\//i.test(value) && (() => { try { new URL(value); return true; } catch { return false; } })(), "Informe um link HTTP ou HTTPS válido.").default(""),
  tecStatus: z.enum(["SUGGESTED", "CONFIRMED"]).default("SUGGESTED"),
});
export const programTopicSchema = tecSchema.extend({ name: z.string().trim().min(1).max(300) });
export const programRowSchema = z.object({ position: z.number().int().min(1).max(16), matter: z.string().trim().min(1).max(200), questionGoal: z.number().int().min(1).max(500), topics: z.array(programTopicSchema).min(4).max(40) });
export const programInputSchema = z.object({ version: z.number().int().min(0), rows: z.array(programRowSchema).length(16), legacyFingerprint: z.string().max(10000).optional(), legacyCredits: z.array(z.object({ position: z.number().int().min(1).max(16), sessionId: z.string().min(1) })).max(16).default([]) }).superRefine((input, ctx) => {
  if (new Set(input.rows.map(row => row.position)).size !== 16) ctx.addIssue({ code: "custom", message: "As posições 1 a 16 devem aparecer exatamente uma vez." });
  if (new Set(input.rows.map(row => row.topics.length)).size !== 1 || input.rows[0].topics.length % 4 !== 0) ctx.addIssue({ code: "custom", message: "Todas as posições precisam do mesmo número de voltas, em blocos de quatro." });
  if (new Set(input.legacyCredits.map(item => item.position)).size !== input.legacyCredits.length || new Set(input.legacyCredits.map(item => item.sessionId)).size !== input.legacyCredits.length) ctx.addIssue({ code: "custom", message: "Uma sessão anterior só pode comprovar uma posição." });
});
export type ProgramRow = z.infer<typeof programRowSchema>;
export type ProgramInput = z.infer<typeof programInputSchema>;

export function legacyCycleFingerprint(entries: { id: string; orderIndex: number; active: boolean; disciplineId: string | null; subjectId: string | null }[], state: { currentOrderIndex: number; roundNumber: number; version: number } | null) {
  return JSON.stringify({ positions: entries.map(entry => [entry.id, entry.orderIndex, entry.active, entry.disciplineId, entry.subjectId]), cursor: state?.currentOrderIndex ?? 1, round: state?.roundNumber ?? 1, version: state?.version ?? 0 });
}

const defaults: [string, number, string[]][] = [
  ["Banco de Dados",20,["SELECT, WHERE e JOIN","Subconsultas, CTE e funções de janela","Transações, ACID e concorrência","Índices, planos e tuning"]],
  ["Engenharia de Software",20,["Engenharia de Requisitos","UML","Testes de Software","SOLID e Arquitetura"]],
  ["Língua Portuguesa",15,["Interpretação e tipologia textual","Reescrita e equivalência semântica","Sintaxe e pontuação","Concordância e regência"]],
  ["Desenvolvimento de Sistemas",20,["POO — classes e encapsulamento","Herança, polimorfismo e interfaces","Java e Python","Padrões de Projeto GoF"]],
  ["Segurança da Informação",20,["Criptografia simétrica e assimétrica","Hash e assinatura digital","Ataques e vulnerabilidades","Gestão de riscos"]],
  ["Raciocínio Lógico-Matemático",10,["Proposições, conectivos e tabelas-verdade","Equivalências e negações","Argumentação lógica","Revisão das dificuldades"]],
  ["Algoritmos e Estruturas de Dados",20,["Vetores, listas, pilhas e filas","Árvores e grafos","Ordenação, pesquisa e hashing","Complexidade Big-O"]],
  ["Banco de Dados",20,["Modelo Entidade-Relacionamento","Modelo relacional e normalização","Procedures, Functions e Triggers","SGBDs relacionais e recuperação"]],
  ["Engenharia de Software",20,["Ciclos de vida e processos","Scrum e Kanban","Qualidade de Software","APF e métricas"]],
  ["Desenvolvimento de Sistemas",20,["APIs REST, HTTP e JSON","Git e versionamento","HTML, CSS e JavaScript","Spring Boot e Django"]],
  ["Língua Portuguesa",15,["Reescrita e reorganização sintática","Coesão e coerência","Crase e colocação pronominal","Revisão mista"]],
  ["Redes de Computadores",20,["OSI e TCP/IP","DNS, DHCP, HTTP e SMTP","IPv4, IPv6, TCP e UDP","VLAN, switching, roteamento e VPN"]],
  ["Raciocínio Lógico-Matemático",10,["Diagramas e conjuntos","Razão, proporção e regra de três","Combinatória e probabilidade","Sequências, PA e PG"]],
  ["Segurança da Informação",20,["Autenticação e controle de acesso","OWASP e segurança web","Certificados digitais e TLS","ISO 27001/27002 e controles"]],
  ["Gestão e Governança de TI",15,["ITIL 4","COBIT 2019","PMBOK 7","Lei 14.133/21 e IN 94/22"]],
  ["Complementar",15,["Sistemas Operacionais","Cloud e DevOps","Inteligência Artificial","LGPD"]],
];

export function defaultProgramRows(): ProgramRow[] {
  return defaults.map(([matter, questionGoal, topics], index) => ({ position: index + 1, matter, questionGoal, topics: topics.map(name => ({ name, tecDiscipline: "", tecTopic: "", tecUrl: "", tecStatus: "SUGGESTED" })) }));
}

export function assertFixedPositions(entries: { orderIndex: number; active: boolean }[]) {
  if (entries.length !== 16 || entries.some((entry, index) => entry.orderIndex !== index + 1 || !entry.active)) throw new Error("A ativação exige as 16 posições ativas de 1 a 16. Seu ciclo não foi alterado.");
}

// Cursor changes never count as completions. A round needs all 16 distinct positions.
export function nextProgramPosition(positions: { id: string; orderIndex: number }[], completed: Set<string>, after: number) {
  const pending = positions.filter(position => !completed.has(position.id));
  return pending.find(position => position.orderIndex > after) ?? pending[0] ?? null;
}

export function programReviewIntervals(questions: number, correct: number) {
  if (!questions) return [];
  const percentage = correct / questions * 100;
  return percentage < 60 ? [1, 7, 30] : percentage < 80 ? [7, 30] : [30];
}

const aliases: Record<string, string[]> = {
  "Língua Portuguesa": ["Português"], "Desenvolvimento de Sistemas": ["Desenvolvimento"],
  "Segurança da Informação": ["Segurança"], "Raciocínio Lógico-Matemático": ["RLM e Matemática"],
  "Redes de Computadores": ["Redes"], "Gestão e Governança de TI": ["Governança e Projetos"],
};
export function matchingMatter<T extends { name: string }>(matter: string, existing: T[]) {
  return existing.find(item => item.name.toLocaleLowerCase("pt-BR") === matter.toLocaleLowerCase("pt-BR")) ?? existing.find(item => aliases[matter]?.includes(item.name));
}
