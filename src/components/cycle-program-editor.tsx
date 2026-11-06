"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProgramRow } from "@/lib/programmed-cycle";
import styles from "./cycle-program.module.css";
import shell from "./official-shell.module.css";

type LegacyEntry = { position: number; matter: string; subjects: string; sessionCount: number; creditCandidates: { id: string; label: string }[] };
export function CycleProgramEditor({ initialRows, legacyFingerprint, version, currentRound, cursor, initialRound, legacyEntries, completed, isFinished }: { initialRows: ProgramRow[]; legacyFingerprint: string; version: number; currentRound: number; cursor: number; initialRound: number; legacyEntries: LegacyEntry[]; completed: string[]; isFinished: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [windowStart, setWindowStart] = useState(Math.floor((currentRound - 1) / 4) * 4);
  const [confirm, setConfirm] = useState(false);
  const [credits, setCredits] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const initial = version === 0;
  const compatible = legacyEntries.length === 0 || legacyEntries.length === 16 && legacyEntries.every((entry, index) => entry.position === index + 1);
  function patchTopic(position: number, round: number, patch: Partial<ProgramRow["topics"][number]>) {
    setRows(previous => previous.map(row => row.position !== position ? row : { ...row, topics: row.topics.map((topic, index) => index !== round ? topic : { ...topic, ...patch, ...(patch.tecDiscipline !== undefined || patch.tecTopic !== undefined || patch.tecUrl !== undefined ? { tecStatus: "SUGGESTED" as const } : {}) }) }));
  }
  async function submit(extend = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cycle/program", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(extend ? { command: "extend", version } : { version, rows, legacyFingerprint, confirmMigration: confirm, legacyCredits: Object.entries(credits).filter(([, id]) => id).map(([position, sessionId]) => ({ position: Number(position), sessionId })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      router.refresh(); router.push(extend ? "/ciclo/configuracao" : "/ciclo");
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <div className={`${styles.editor} ${shell.screen}`}>
    <header><p className="text-xs font-semibold text-primary">16 posições fixas · {rows[0].topics.length} voltas programadas</p><h1>Programação do ciclo</h1><p>Edite os assuntos e as referências. Os resultados anteriores ficam vinculados às sessões originais.</p><Link href="/ciclo">← Voltar ao ciclo</Link></header>
    {initial ? <section className={styles.notice} aria-labelledby="migration-title"><h2 id="migration-title">Compare antes de ativar</h2><p>Seu ciclo continua funcionando até a confirmação. As posições existentes e seus IDs serão reaproveitados; os assuntos abaixo passam a ser a programação exibida em cada volta. Matérias e assuntos antigos não serão apagados.</p><p>Cursor preservado: posição <strong>{cursor}</strong>, volta anterior <strong>{initialRound}</strong>. A programação começa na volta 1/4, com as conclusões anteriores apenas se você as vincular abaixo.</p>
      {legacyEntries.length ? <details><summary>Ver posições atuais e propostas ({legacyEntries.length})</summary><div className={styles.comparison}>{legacyEntries.map(entry => <div key={entry.position}><strong>#{entry.position} · {entry.matter}</strong><p>{entry.subjects} · {entry.sessionCount} sessões preservadas</p><p>Programação proposta: {rows.find(row => row.position === entry.position)?.matter ?? "posição fora do modelo"}</p>{entry.creditCandidates.length ? <label>Aproveitar conclusão na volta 1 <select value={credits[entry.position] ?? ""} onChange={event => setCredits(value => ({ ...value, [entry.position]: event.target.value }))}><option value="">Não vincular automaticamente</option>{entry.creditCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label> : null}</div>)}</div></details> : <p>Este guia está vazio. As 16 posições serão criadas somente ao confirmar.</p>}
      <p className="text-xs">Sessões sem volta identificada nunca são atribuídas automaticamente. Vincular uma conclusão aproveita o registro existente; não cria outra sessão.</p>
      {!compatible ? <p role="alert">Este guia não tem 16 posições consecutivas. A ativação está bloqueada para preservar seu ciclo; use um guia vazio ou revise o mapeamento.</p> : null}
    </section> : <section className={styles.notice}><p>Volta atual: <strong>{currentRound}/{rows[0].topics.length}</strong> · posição <strong>{cursor}/16</strong>. Editar uma célula altera a programação; nomes, referências e resultados das sessões já salvas são preservados. Uma posição já concluída continua concluída.</p></section>}
    {rows[0].topics.length > 4 ? <nav className={styles.windows} aria-label="Blocos de voltas">{Array.from({ length: rows[0].topics.length / 4 }, (_, index) => <button key={index} onClick={() => setWindowStart(index * 4)} aria-pressed={windowStart === index * 4}>Voltas {index * 4 + 1}–{index * 4 + 4}</button>)}</nav> : null}
    <div className={styles.matrix} tabIndex={0} role="region" aria-label="Matriz das quatro voltas"><table><caption>16 posições × quatro voltas por vez · role horizontalmente no celular</caption><thead><tr><th scope="col">Posição e matéria</th>{[0,1,2,3].map(offset => <th key={offset} scope="col">Volta {windowStart + offset + 1}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.position}><th scope="row"><span>#{row.position}</span><label>Matéria<input aria-label={`Matéria da posição ${row.position}`} value={row.matter} onChange={event => setRows(value => value.map(item => item.position !== row.position ? item : { ...item, matter: event.target.value }))}/></label><label>Meta de questões<input type="number" min={1} max={500} aria-label={`Meta da posição ${row.position}`} value={row.questionGoal} onChange={event => setRows(value => value.map(item => item.position !== row.position ? item : { ...item, questionGoal: Number(event.target.value) }))}/></label></th>{row.topics.slice(windowStart, windowStart + 4).map((topic, offset) => { const round = windowStart + offset; return <td key={round}><label className={styles.topicLabel}>Assunto<textarea rows={3} aria-label={`Assunto da posição ${row.position}, volta ${round + 1}`} value={topic.name} onChange={event => patchTopic(row.position, round, { name: event.target.value })}/></label>{completed.includes(`${row.position}:${round + 1}`) ? <span className={styles.complete}>Posição concluída · resultados preservados</span> : null}<details><summary>TecConcursos · {topic.tecStatus === "CONFIRMED" ? "confirmado por você" : "sugerido"}</summary><label>Matéria no Tec<input aria-label={`Matéria Tec ${row.position}:${round + 1}`} value={topic.tecDiscipline} onChange={event => patchTopic(row.position, round, { tecDiscipline: event.target.value })}/></label><label>Tópico ou subtópico<input aria-label={`Tópico Tec ${row.position}:${round + 1}`} value={topic.tecTopic} onChange={event => patchTopic(row.position, round, { tecTopic: event.target.value })}/></label><label>Link do caderno ou filtro<input type="url" aria-label={`Link Tec ${row.position}:${round + 1}`} value={topic.tecUrl} onChange={event => patchTopic(row.position, round, { tecUrl: event.target.value })}/></label><label>Classificação<select aria-label={`Classificação Tec ${row.position}:${round + 1}`} value={topic.tecStatus} onChange={event => patchTopic(row.position, round, { tecStatus: event.target.value as "SUGGESTED" | "CONFIRMED" })}><option value="SUGGESTED">Sugerida · ainda não conferida</option><option value="CONFIRMED">Confirmada por mim no Tec</option></select></label></details></td>; })}</tr>)}</tbody><tfoot><tr><th>Total por volta</th>{[0,1,2,3].map(index => <td key={index}>{rows.reduce((sum, row) => sum + row.questionGoal, 0)} questões · 16 posições</td>)}</tr></tfoot></table></div>
    <p className="text-xs text-textSecondary">Os nomes são sugestões de estudo, não classificações oficiais do TecConcursos. Alterar uma referência retira sua confirmação até você conferi-la novamente.</p>
    {error ? <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 p-4 text-sm">{error}</p> : null}
    <footer className={styles.save}>{initial ? <label><input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)}/> Revisei a comparação e autorizo ativar esta programação, preservando os registros atuais.</label> : null}<button disabled={busy || initial && (!confirm || !compatible)} className="sf-primary" onClick={() => submit()}>{busy ? "Salvando…" : initial ? "Ativar programação revisada" : "Salvar programação"}</button>{isFinished ? <button disabled={busy} className="sf-secondary" onClick={() => submit(true)}>Acrescentar quatro voltas a partir deste modelo</button> : null}<Link href="/ciclo" className="sf-secondary">Cancelar</Link></footer>
  </div>;
}
