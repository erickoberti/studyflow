"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StudyGuideIcon } from "@/components/study-guide-icon";
import {
  createOfflineGuide,
  deleteOfflineGuide,
  getOfflineSnapshot,
  selectOfflineGuide,
  subscribeOfflineStore,
  updateOfflineGuide,
} from "@/lib/offline/store";
import { getActiveOfflineGuide, getOfflineDisciplines } from "@/lib/offline/selectors";

const ICONS = ["book-open", "graduation-cap", "briefcase", "code-2", "scale", "flask-conical", "globe", "monitor-play"] as const;
const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#64748b"] as const;
type GuideFormState = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
};

export function OfflineGuideManager() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());
  const activeGuide = getActiveOfflineGuide(snapshot);
  const [form, setForm] = useState<GuideFormState>({
    id: "",
    name: "",
    description: "",
    icon: ICONS[0],
    color: COLORS[0],
  });
  const disciplines = useMemo(() => getOfflineDisciplines(snapshot, activeGuide?.id), [activeGuide?.id, snapshot]);

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);

  useEffect(() => {
    if (!activeGuide) return;
    setForm({
      id: activeGuide.id,
      name: activeGuide.name,
      description: activeGuide.description ?? "",
      icon: (activeGuide.icon as (typeof ICONS)[number]) ?? ICONS[0],
      color: (activeGuide.color as (typeof COLORS)[number]) ?? COLORS[0],
    });
  }, [activeGuide]);

  function save() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do guia.");
      return;
    }

    if (form.id) {
      updateOfflineGuide(form.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        icon: form.icon,
        color: form.color,
      });
      toast.success("Guia atualizado localmente.");
      return;
    }

    createOfflineGuide({
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      color: form.color,
    });
    toast.success("Guia criado localmente.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] pb-10">
      <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <h2 className="text-xl font-black">Guia offline</h2>
        <div className="mt-4 space-y-3">
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do guia" className="h-11 w-full rounded-2xl border border-slate-300 px-3" />
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descrição" rows={4} className="w-full rounded-2xl border border-slate-300 p-3" />
          <div className="flex flex-wrap gap-2">
            {ICONS.map((icon) => (
              <button key={icon} type="button" onClick={() => setForm((current) => ({ ...current, icon }))} className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${form.icon === icon ? "border-primary bg-primary text-white" : "border-slate-300"}`}>
                <StudyGuideIcon icon={icon} className="h-4 w-4" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button key={color} type="button" onClick={() => setForm((current) => ({ ...current, color }))} className={`h-9 w-9 rounded-full border-2 ${form.color === color ? "border-slate-900" : "border-transparent"}`} style={{ backgroundColor: color }} />
            ))}
          </div>
          <button type="button" onClick={save} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-white">
            {form.id ? "Salvar guia" : "Criar guia"}
          </button>
          {!form.id ? null : (
            <button type="button" onClick={() => deleteOfflineGuide(form.id)} className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-black text-rose-600">
              Excluir guia
            </button>
          )}
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <h2 className="text-xl font-black">Guias locais</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.guides.map((guide) => (
            <button key={guide.id} type="button" onClick={() => selectOfflineGuide(guide.id)} className={`rounded-3xl border p-4 text-left ${guide.id === activeGuide?.id ? "border-primary bg-primary/5" : "border-slate-200"}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${guide.color}18`, color: guide.color }}>
                  <StudyGuideIcon icon={guide.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-black">{guide.name}</p>
                  <p className="text-xs text-slate-500">{getOfflineDisciplines(snapshot, guide.id).length} disciplinas</p>
                </div>
              </div>
            </button>
          ))}
          <button type="button" onClick={() => setForm({ id: "", name: "", description: "", icon: ICONS[0], color: COLORS[0] })} className="rounded-3xl border border-dashed border-slate-300 p-4 text-left">
            <p className="font-black text-primary">Novo guia</p>
            <p className="text-xs text-slate-500">Cria um guia local e sincroniza depois.</p>
          </button>
        </div>
        <div className="mt-5 rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
          <p className="text-sm font-black">{activeGuide?.name ?? "Nenhum guia selecionado"}</p>
          <p className="mt-1 text-sm text-slate-500">{disciplines.length} disciplinas no guia ativo.</p>
        </div>
      </article>
    </div>
  );
}
