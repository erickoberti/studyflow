"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Plus, Search } from "lucide-react";
import { deleteGuideDisciplineAction, deleteSubjectAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import styles from "./discipline-catalog.module.css";

type Topic = { id: string; name: string; weight: number; notes: string | null; tecReference: string | null; active: boolean; questions: number; percentage: number; studied: boolean };
type Group = { id: string; name: string; active: boolean; topics: Topic[] };

export function DisciplineCatalog({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [discipline, setDiscipline] = useState("");
  const selectedMatter = groups.find(group => group.id === discipline);
  const studied = selectedMatter?.topics.filter(topic => topic.studied).length ?? 0;
  const questions = selectedMatter?.topics.reduce((sum, topic) => sum + topic.questions, 0) ?? 0;
  const accuracy = questions ? selectedMatter!.topics.reduce((sum, topic) => sum + topic.percentage * topic.questions, 0) / questions : 0;
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const visible = groups.filter(group => !discipline || group.id === discipline).map(group => ({
    ...group,
    topics: group.topics.filter(topic =>
      `${group.name} ${topic.name} ${topic.notes ?? ""} ${topic.tecReference ?? ""}`.toLocaleLowerCase("pt-BR").includes(search) &&
      (filter === "all" || filter === "weight" && topic.weight >= 2 || filter === "low" && topic.questions > 0 && topic.percentage < 70)),
  })).filter(group => group.topics.length || (filter === "all" && !groups.find(item => item.id === group.id)?.topics.length && group.name.toLocaleLowerCase("pt-BR").includes(search)));
  const count = visible.reduce((sum, group) => sum + group.topics.length, 0);

  function matterActions(group: Group) {
    return <>
      <Link href={`/base?tab=assuntos&novo=1&discipline=${group.id}`}>Adicionar assunto nesta matéria</Link>
      <Link href={`/base?tab=disciplinas&edit=${group.id}`}>Editar matéria</Link>
      <form action={deleteGuideDisciplineAction}>
        <input type="hidden" name="disciplineId" value={group.id} />
        <ConfirmSubmitButton message={`Excluir a matéria ${group.name} e seus assuntos?`} className={styles.danger}>Excluir matéria</ConfirmSubmitButton>
      </form>
    </>;
  }

  return <div className={styles.catalog}>
    <div className={styles.filters}>
      <label className={styles.search}><Search size={17} aria-hidden /><input aria-label="Buscar matéria ou assunto" placeholder="Buscar matéria ou assunto…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <select aria-label="Filtrar por matéria" value={discipline} onChange={event => setDiscipline(event.target.value)}>
        <option value="">Todas as matérias</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
      <div className={styles.tabs} role="group" aria-label="Filtrar assuntos">
        {[["all", "Todos"], ["weight", "Peso 2+"], ["low", "Acertos <70%"]].map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
    </div>
    <p className={styles.result} role="status">{count} {count === 1 ? "assunto" : "assuntos"} em {visible.length} {visible.length === 1 ? "matéria" : "matérias"} · Matéria → Assunto</p>
    {selectedMatter ? <section className={styles.matterSummary} aria-label={`Progresso de ${selectedMatter.name}`}>
      <p><strong>{selectedMatter.name}</strong> · {studied}/{selectedMatter.topics.length} assuntos estudados · {questions ? `${questions} questões · ${accuracy.toFixed(0)}% de acertos` : "sem questões registradas"}</p>
      <div role="progressbar" aria-label="Assuntos estudados na matéria" aria-valuemin={0} aria-valuemax={100} aria-valuenow={selectedMatter.topics.length ? Math.round(studied / selectedMatter.topics.length * 100) : 0}><i style={{ width: `${selectedMatter.topics.length ? studied / selectedMatter.topics.length * 100 : 0}%` }} /></div>
    </section> : null}
    <div className={styles.list}>
      {visible.map(group => group.topics.length ? group.topics.map(topic => <article key={topic.id} className={styles.topic} aria-label={`${group.name} → ${topic.name}`}>
        <div className={styles.topicText}>
          <h2><strong>{group.name}</strong> <span aria-hidden>→</span> {topic.name}</h2>
          <p className={styles.meta}><span>Peso {topic.weight.toFixed(1)}</span><span>{topic.questions > 0 ? `${topic.questions} questões · ${topic.percentage.toFixed(0)}% de acertos` : topic.studied ? "Estudo registrado · sem questões" : "Sem estudos registrados"}</span></p>
          {topic.notes ? <p className={styles.note}>{topic.notes}</p> : null}
          {topic.tecReference ? <p className={styles.note}>TEC: {topic.tecReference}</p> : null}
        </div>
        <span className={styles.badge} data-state={!group.active || !topic.active ? "paused" : topic.questions > 0 && topic.percentage < 70 ? "low" : "normal"}>{!group.active || !topic.active ? "Pausado" : topic.questions > 0 && topic.percentage < 70 ? "Reforçar" : topic.studied ? "Estudado" : "A estudar"}</span>
        <div className={styles.actions}>
          <Link href={`/base?tab=assuntos&editSubject=${topic.id}`} aria-label={`Editar ${group.name} → ${topic.name}`}><Pencil size={16} aria-hidden /></Link>
          <details><summary aria-label={`Ações de ${group.name} → ${topic.name}`}><MoreVertical size={17} aria-hidden /></summary><div className={styles.menu}>
            <form action={deleteSubjectAction}><input type="hidden" name="subjectId" value={topic.id} /><ConfirmSubmitButton message={`Excluir o assunto ${topic.name}?`} className={styles.danger}>Excluir assunto</ConfirmSubmitButton></form>
            {matterActions(group)}
          </div></details>
        </div>
      </article>) : <article key={group.id} className={styles.topic}>
        <div className={styles.topicText}><h2><strong>{group.name}</strong></h2><p className={styles.note}>Nenhum assunto cadastrado{!group.active ? " · matéria pausada" : ""}.</p></div>
        <div className={styles.actions}><Link href={`/base?tab=assuntos&novo=1&discipline=${group.id}`} aria-label={`Adicionar assunto em ${group.name}`}><Plus size={18} /></Link><details><summary aria-label={`Ações de ${group.name}`}><MoreVertical size={17} /></summary><div className={styles.menu}>{matterActions(group)}</div></details></div>
      </article>)}
      {!visible.length ? <div className={styles.empty}><h2>{groups.length ? "Nenhum resultado" : "Suas matérias começam aqui"}</h2><p>{groups.length ? "Tente outro termo ou ajuste os filtros." : "Adicione uma matéria e cadastre os assuntos que vai estudar."}</p>{groups.length ? <button onClick={() => { setQuery(""); setFilter("all"); setDiscipline(""); }}>Limpar filtros</button> : <Link href="/base?tab=disciplinas&novo=1">Adicionar matéria</Link>}</div> : null}
    </div>
    <footer className={styles.footer}><span>Pesos e referências continuam vinculados a cada assunto.</span><Link href="/api/import/base/template">Baixar modelo CSV</Link></footer>
  </div>;
}
