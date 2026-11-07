"use client";

import { useState } from "react";
import Link from "next/link";
import { parseTecReference } from "@/lib/tec-reference";

export function SubjectReferenceFields({ initialReference, groupName, programmed = false }: { initialReference?: string | null; groupName?: string | null; programmed?: boolean }) {
  const initial = parseTecReference(initialReference);
  const [topic, setTopic] = useState(initial.topic);
  const [url, setUrl] = useState(initial.url ?? "");
  const [status, setStatus] = useState(initial.status);
  const field = "mt-1.5 w-full rounded-control border bg-surface px-3 py-2 text-sm text-textPrimary";
  return <fieldset className="space-y-4 rounded-card border bg-surface p-4">
    <legend className="px-2 text-sm font-semibold">Organização e TecConcursos</legend>
    <label className="block text-sm font-medium">Assunto principal <span className="font-normal text-textSecondary">(opcional)</span><input name="groupName" maxLength={300} defaultValue={groupName ?? ""} placeholder="Ex.: SQL — o nome acima será o subassunto" className={field} /><span className="mt-1 block text-xs font-normal text-textSecondary">Preencha para organizar Matéria → Assunto principal → Subassunto. Deixe vazio para manter Matéria → Assunto.</span></label>
    {programmed ? <p className="text-sm leading-relaxed text-textSecondary">Este assunto faz parte das voltas programadas. Altere o conteúdo e as referências na <Link href="/ciclo/configuracao" className="text-primary underline">matriz do ciclo</Link>. Aqui você pode organizar o assunto e salvar anotações.</p> : <><div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Tópico no TecConcursos<input name="tecReference" value={topic} onChange={event => { setTopic(event.target.value); setStatus("SUGGESTED"); }} placeholder="Nome do tópico ou subassunto no Tec" className={field} /></label>
      <label className="block text-sm font-medium">Link direto do caderno<input name="tecUrl" type="url" pattern="https?://.*" value={url} onChange={event => { setUrl(event.target.value); setStatus("SUGGESTED"); }} placeholder="https://www.tecconcursos.com.br/…" className={field} /></label>
      <label className="block text-sm font-medium sm:col-span-2">Classificação<select aria-label="Classificação" name="tecStatus" value={status} onChange={event => setStatus(event.target.value as typeof status)} className={field}><option value="SUGGESTED">Sugerida · ainda não conferida</option><option value="CONFIRMED">Confirmada por mim no TecConcursos</option></select></label>
    </div>
    <p className="text-xs leading-relaxed text-textSecondary">Cadastre uma referência para abrir o caderno durante o estudo. A confirmação é sua; não há conexão automática com o TecConcursos. Alterar o tópico ou o link pede uma nova conferência.</p>
    </>}
  </fieldset>;
}
