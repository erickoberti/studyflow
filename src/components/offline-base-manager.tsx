"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createOfflineDiscipline,
  createOfflineSubject,
  deleteOfflineDiscipline,
  getOfflineSnapshot,
  subscribeOfflineStore,
  updateOfflineDiscipline,
  updateOfflineSubject,
} from "@/lib/offline/store";
import { getActiveOfflineGuide, getOfflineDisciplines, getOfflineSubjects } from "@/lib/offline/selectors";

export function OfflineBaseManager() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const [tab, setTab] = useState<"disciplinas" | "assuntos">("disciplinas");
  const activeGuide = getActiveOfflineGuide(snapshot);
  const disciplines = useMemo(() => getOfflineDisciplines(snapshot, activeGuide?.id), [activeGuide?.id, snapshot]);
  const subjects = useMemo(() => getOfflineSubjects(snapshot, activeGuide?.id), [activeGuide?.id, snapshot]);
  const [disciplineForm, setDisciplineForm] = useState({ id: "", name: "", category: "", sortOrder: "" });
  const [subjectForm, setSubjectForm] = useState({
    id: "",
    name: "",
    disciplineId: "",
    weight: "1",
    orderIndex: "",
    tecReference: "",
    notes: "",
  });

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);

  function saveDiscipline() {
    if (!activeGuide || !disciplineForm.name.trim()) {
      toast.error("Informe o nome da disciplina.");
      return;
    }

    if (disciplineForm.id) {
      const current = disciplines.find((discipline) => discipline.id === disciplineForm.id);
      updateOfflineDiscipline(disciplineForm.id, {
        name: disciplineForm.name.trim(),
        category: disciplineForm.category.trim() || null,
        sortOrder: disciplineForm.sortOrder ? Number(disciplineForm.sortOrder) : null,
        active: current?.active ?? true,
      });
      toast.success("Disciplina atualizada localmente.");
    } else {
      createOfflineDiscipline({
        guideId: activeGuide.id,
        name: disciplineForm.name.trim(),
        category: disciplineForm.category.trim() || null,
        sortOrder: disciplineForm.sortOrder ? Number(disciplineForm.sortOrder) : null,
      });
      toast.success("Disciplina criada localmente.");
    }

    setDisciplineForm({ id: "", name: "", category: "", sortOrder: "" });
  }

  function saveSubject() {
    if (!activeGuide || !subjectForm.name.trim() || !subjectForm.disciplineId) {
      toast.error("Preencha os dados do assunto.");
      return;
    }

    const payload = {
      disciplineId: subjectForm.disciplineId,
      name: subjectForm.name.trim(),
      weight: Number(subjectForm.weight) || 1,
      notes: subjectForm.notes.trim() || null,
      tecReference: subjectForm.tecReference.trim() || null,
      active: true,
      orderIndex: subjectForm.orderIndex ? Number(subjectForm.orderIndex) : null,
    };

    if (subjectForm.id) {
      updateOfflineSubject(subjectForm.id, payload);
      toast.success("Assunto atualizado localmente.");
    } else {
      createOfflineSubject({
        guideId: activeGuide.id,
        ...payload,
      });
      toast.success("Assunto criado localmente.");
    }

    setSubjectForm({
      id: "",
      name: "",
      disciplineId: disciplines[0]?.id ?? "",
      weight: "1",
      orderIndex: "",
      tecReference: "",
      notes: "",
    });
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("disciplinas")} className={`rounded-full px-4 py-2 text-sm font-black ${tab === "disciplinas" ? "bg-primary text-white" : "border border-slate-300"}`}>
          Disciplinas
        </button>
        <button type="button" onClick={() => setTab("assuntos")} className={`rounded-full px-4 py-2 text-sm font-black ${tab === "assuntos" ? "bg-primary text-white" : "border border-slate-300"}`}>
          Assuntos
        </button>
      </div>

      {tab === "disciplinas" ? (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-xl font-black">Disciplina offline</h2>
            <div className="mt-4 space-y-3">
              <input value={disciplineForm.name} onChange={(event) => setDisciplineForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
              <input value={disciplineForm.category} onChange={(event) => setDisciplineForm((current) => ({ ...current, category: event.target.value }))} placeholder="Categoria" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
              <input value={disciplineForm.sortOrder} onChange={(event) => setDisciplineForm((current) => ({ ...current, sortOrder: event.target.value }))} placeholder="Ordem" type="number" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
              <button type="button" onClick={saveDiscipline} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-white">
                {disciplineForm.id ? "Salvar disciplina" : "Criar disciplina"}
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-xl font-black">Disciplinas do guia</h2>
            <div className="mt-4 space-y-3">
              {disciplines.map((discipline) => (
                <div key={discipline.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{discipline.name}</p>
                    <p className="text-xs text-slate-500">{discipline.category ?? "Sem categoria"} | ordem {discipline.sortOrder ?? "-"}</p>
                  </div>
                  <button type="button" onClick={() => setDisciplineForm({ id: discipline.id, name: discipline.name, category: discipline.category ?? "", sortOrder: discipline.sortOrder?.toString() ?? "" })} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                    Editar
                  </button>
                  <button type="button" onClick={() => deleteOfflineDiscipline(discipline.id)} className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-black text-rose-600">
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-xl font-black">Assunto offline</h2>
            <div className="mt-4 space-y-3">
              <input value={subjectForm.name} onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="Assunto" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
              <select value={subjectForm.disciplineId} onChange={(event) => setSubjectForm((current) => ({ ...current, disciplineId: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-300 px-3">
                <option value="">Selecione a disciplina</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={subjectForm.weight} onChange={(event) => setSubjectForm((current) => ({ ...current, weight: event.target.value }))} placeholder="Peso" type="number" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
                <input value={subjectForm.orderIndex} onChange={(event) => setSubjectForm((current) => ({ ...current, orderIndex: event.target.value }))} placeholder="Ordem no ciclo" type="number" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
              </div>
              <input value={subjectForm.tecReference} onChange={(event) => setSubjectForm((current) => ({ ...current, tecReference: event.target.value }))} placeholder="Referencia TEC" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
              <textarea value={subjectForm.notes} onChange={(event) => setSubjectForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas" rows={4} className="w-full rounded-2xl border border-slate-300 p-3" />
              <button type="button" onClick={saveSubject} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-white">
                {subjectForm.id ? "Salvar assunto" : "Criar assunto"}
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-xl font-black">Assuntos do guia</h2>
            <div className="mt-4 space-y-3">
              {subjects.map((subject) => {
                const discipline = disciplines.find((item) => item.id === subject.disciplineId);
                return (
                  <div key={subject.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{subject.name}</p>
                      <p className="text-xs text-slate-500">{discipline?.name ?? "-"} | peso {subject.weight} | ordem {subject.orderIndex ?? "-"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSubjectForm({
                          id: subject.id,
                          name: subject.name,
                          disciplineId: subject.disciplineId,
                          weight: String(subject.weight),
                          orderIndex: subject.orderIndex?.toString() ?? "",
                          tecReference: subject.tecReference ?? "",
                          notes: subject.notes ?? "",
                        })
                      }
                      className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary"
                    >
                      Editar
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
