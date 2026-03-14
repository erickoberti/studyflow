"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FolderKanban, PencilLine, Plus, Rows3, Trash2, X } from "lucide-react";
import {
  createGuideDisciplineAction,
  createStudyGuideAction,
  deleteGuideDisciplineAction,
  deleteStudyGuideAction,
  selectStudyGuideAction,
  toggleGuideDisciplineAction,
  updateGuideDisciplineAction,
  updateStudyGuideAction,
} from "@/app/actions";
import { StudyGuideIcon } from "@/components/study-guide-icon";

type GuideDiscipline = {
  id: string;
  name: string;
  category: string | null;
  active: boolean;
  subjectCount: number;
};

type GuideItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  disciplines: GuideDiscipline[];
};

function GuidePreview({
  name,
  description,
  icon,
  color,
  disciplines,
}: {
  name: string;
  description?: string | null;
  icon: string;
  color: string;
  disciplines: GuideDiscipline[];
}) {
  const activeCount = disciplines.filter((item) => item.active).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#151225]">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Preview</span>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
        </div>
      </div>

      <div className="p-6 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-8"
          style={{
            backgroundColor: `${color}12`,
            color,
            boxShadow: `0 0 0 8px ${color}10`,
          }}
        >
          <StudyGuideIcon icon={icon} className="h-7 w-7" />
        </div>

        <h3 className="mt-5 text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
          {name || "Novo guia"}
        </h3>
        <p className="mx-auto mt-3 max-w-[280px] text-sm text-slate-500 dark:text-slate-400">
          {description || "Defina o foco deste guia e mantenha as materias organizadas em um so lugar."}
        </p>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            <span>Materias</span>
            <span className="text-primary">{disciplines.length} total</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: disciplines.length ? `${Math.max((activeCount / disciplines.length) * 100, 12)}%` : "12%",
                backgroundColor: color,
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {disciplines.slice(0, 4).map((discipline) => (
            <span
              key={discipline.id}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              {discipline.name}
            </span>
          ))}
          {!disciplines.length ? (
            <span className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-400 dark:border-white/10">
              Sem materias
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GuideList({
  guides,
  activeGuideId,
}: {
  guides: GuideItem[];
  activeGuideId: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#151225]">
      <div className="mb-4 flex items-center gap-2">
        <FolderKanban className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-800 dark:text-white">Guias cadastrados</h4>
      </div>

      <div className="space-y-3">
        {guides.map((guide) => (
          <form key={guide.id} action={selectStudyGuideAction}>
            <input type="hidden" name="studyGuideId" value={guide.id} />
            <button
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                guide.id === activeGuideId
                  ? "border-primary/20 bg-primary/10"
                  : "border-slate-200 bg-white hover:border-primary/20 hover:bg-slate-50 dark:border-white/10 dark:bg-[#1c1630] dark:hover:bg-white/5"
              }`}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${guide.color}16`, color: guide.color }}
              >
                <StudyGuideIcon icon={guide.icon} className="h-4 w-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-black leading-tight ${
                    guide.id === activeGuideId ? "text-primary" : "text-slate-800 dark:text-white"
                  }`}
                >
                  {guide.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-400">{guide.disciplines.length} materias</span>
              </span>

              {guide.id === activeGuideId ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function GuideEditor({
  mode,
  guide,
  iconOptions,
  colorOptions,
  selectedIcon,
  selectedColor,
  onIconChange,
  onColorChange,
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: {
  mode: "create" | "edit";
  guide?: GuideItem | null;
  iconOptions: readonly string[];
  colorOptions: readonly string[];
  selectedIcon: string;
  selectedColor: string;
  onIconChange: (value: string) => void;
  onColorChange: (value: string) => void;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#151225]">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <PencilLine className="h-4 w-4" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {mode === "create" ? "Novo guia" : "Guia atual"}
        </h2>
      </div>

      <div className="grid grid-cols-12 items-start gap-4">
        <div className="col-span-12 xl:col-span-8 space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Nome do guia</label>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Ex.: Analista de TI - UERJ"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary dark:border-white/10 dark:bg-[#24173b] dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Descricao</label>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Sem descricao cadastrada."
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-[#24173b] dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-[#151225] dark:text-slate-300">
                <StudyGuideIcon icon={selectedIcon} className="h-3.5 w-3.5" />
                Icone selecionado
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-[#151225] dark:text-slate-300">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: selectedColor }} />
                {selectedColor}
              </span>
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {mode === "create" ? "Novo guia" : guide ? "Guia principal" : ""}
            </span>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Icone</label>
              <div className="grid grid-cols-4 gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-[#1c1630]">
                {iconOptions.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => onIconChange(icon)}
                    className={`flex h-12 w-full items-center justify-center rounded-xl border transition ${
                      selectedIcon === icon
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-primary/30 dark:border-white/10 dark:bg-[#151225] dark:text-slate-300"
                    }`}
                  >
                    <StudyGuideIcon icon={icon} className="h-4.5 w-4.5" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Cor</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-white/10 dark:bg-[#1c1630]">
                <div className="grid grid-cols-2 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onColorChange(color)}
                      className={`mx-auto h-9 w-9 rounded-full border-2 transition ${
                        selectedColor === color ? "border-slate-900 ring-2 ring-primary dark:border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="mt-3 block text-[10px] font-medium text-slate-400">{selectedColor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuideManager({
  guides,
  activeGuideId,
  iconOptions,
  colorOptions,
}: {
  guides: GuideItem[];
  activeGuideId: string;
  iconOptions: readonly string[];
  colorOptions: readonly string[];
}) {
  const activeGuide = useMemo(
    () => guides.find((guide) => guide.id === activeGuideId) ?? guides[0] ?? null,
    [activeGuideId, guides],
  );

  const [mode, setMode] = useState<"create" | "edit">(guides.length === 0 ? "create" : "edit");
  const [selectedIcon, setSelectedIcon] = useState(activeGuide?.icon ?? iconOptions[0] ?? "book-open");
  const [selectedColor, setSelectedColor] = useState(activeGuide?.color ?? colorOptions[0] ?? "#6366f1");
  const [draftName, setDraftName] = useState(activeGuide?.name ?? "");
  const [draftDescription, setDraftDescription] = useState(activeGuide?.description ?? "");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState(iconOptions[0] ?? "book-open");
  const [newColor, setNewColor] = useState(colorOptions[0] ?? "#6366f1");

  useEffect(() => {
    if (!activeGuide) return;
    setSelectedIcon(activeGuide.icon);
    setSelectedColor(activeGuide.color);
    setDraftName(activeGuide.name);
    setDraftDescription(activeGuide.description ?? "");
    if (mode !== "create") {
      setMode("edit");
    }
  }, [activeGuide, mode]);

  const previewGuide =
    mode === "create"
      ? {
          name: newName,
          description: newDescription,
          icon: newIcon,
          color: newColor,
          disciplines: [] as GuideDiscipline[],
        }
      : {
          name: draftName || activeGuide?.name || "",
          description: draftDescription || activeGuide?.description || "",
          icon: selectedIcon,
          color: selectedColor,
          disciplines: activeGuide?.disciplines ?? [],
        };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Guias de estudo</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Edite identidade, cor, icone e materias sem sair da mesma tela.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <details className="relative">
            <summary className="flex list-none cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">
              <span>Trocar guia</span>
              <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-black text-white">
                {activeGuide?.name ?? "Nenhum guia"}
              </span>
            </summary>

            <div className="absolute right-0 z-20 mt-3 w-[320px] rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl dark:border-slate-800 dark:bg-[#151225]">
              <div className="space-y-2">
                {guides.map((guide) => (
                  <form key={guide.id} action={selectStudyGuideAction}>
                    <input type="hidden" name="studyGuideId" value={guide.id} />
                    <button
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        guide.id === activeGuideId
                          ? "border border-primary/20 bg-primary/10"
                          : "border border-slate-200 bg-white hover:border-primary/20 hover:bg-slate-50 dark:border-white/10 dark:bg-[#1c1630] dark:hover:bg-white/5"
                      }`}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${guide.color}16`, color: guide.color }}
                      >
                        <StudyGuideIcon icon={guide.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-slate-800 dark:text-white">{guide.name}</span>
                        <span className="block text-[11px] text-slate-400">{guide.disciplines.length} materias</span>
                      </span>
                      {guide.id === activeGuideId ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </details>

          <button
            type="button"
            onClick={() => setMode((value) => (value === "create" ? "edit" : "create"))}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-[#151225] dark:text-white"
          >
            {mode === "create" ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {mode === "create" ? "Fechar novo guia" : "Novo guia"}
          </button>

          {activeGuide ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              disabled={mode === "edit"}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-default disabled:opacity-60 dark:border-white/10 dark:bg-[#151225] dark:text-white"
            >
              <PencilLine className="h-4 w-4" />
              {mode === "edit" ? "Editando guia" : "Editar guia"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {mode === "create" ? (
            <form action={createStudyGuideAction} className="space-y-5">
              <input type="hidden" name="icon" value={newIcon} />
              <input type="hidden" name="color" value={newColor} />
              <GuideEditor
                mode="create"
                iconOptions={iconOptions}
                colorOptions={colorOptions}
                selectedIcon={newIcon}
                selectedColor={newColor}
                onIconChange={setNewIcon}
                onColorChange={setNewColor}
                name={newName}
                description={newDescription}
                onNameChange={setNewName}
                onDescriptionChange={setNewDescription}
              />
              <div className="flex justify-end">
                <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white">Criar guia</button>
              </div>
            </form>
          ) : activeGuide ? (
            <form action={updateStudyGuideAction} className="space-y-5">
              <input type="hidden" name="icon" value={selectedIcon} />
              <input type="hidden" name="color" value={selectedColor} />
              <GuideEditor
                mode="edit"
                guide={activeGuide}
                iconOptions={iconOptions}
                colorOptions={colorOptions}
                selectedIcon={selectedIcon}
                selectedColor={selectedColor}
                onIconChange={setSelectedIcon}
                onColorChange={setSelectedColor}
                name={draftName}
                description={draftDescription}
                onNameChange={setDraftName}
                onDescriptionChange={setDraftDescription}
              />
              <div className="flex items-center justify-between gap-3">
                <div>
                  {guides.length > 1 ? (
                    <button
                      type="submit"
                      formAction={deleteStudyGuideAction}
                      name="studyGuideId"
                      value={activeGuide.id}
                      onClick={(event) => {
                        if (!window.confirm(`Excluir o guia "${activeGuide.name}"? Essa acao remove os dados vinculados a ele.`)) {
                          event.preventDefault();
                        }
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Excluir guia
                      </span>
                    </button>
                  ) : null}
                </div>
                <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white">Salvar guia</button>
              </div>
            </form>
          ) : null}

          {activeGuide ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#151225]">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Rows3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black leading-none text-slate-900 dark:text-white">Assuntos / materias</h2>
                    <p className="mt-1 text-xs text-slate-400">Tudo em formato compacto para caber na mesma tela.</p>
                  </div>
                </div>

                <form action={createGuideDisciplineAction} className="flex flex-wrap items-center gap-2">
                  <input
                    name="name"
                    placeholder="Nova materia"
                    className="w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-[#24173b] dark:text-white"
                  />
                  <input
                    name="category"
                    placeholder="Descricao curta"
                    className="w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-[#24173b] dark:text-white"
                  />
                  <button className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white">
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                </form>
              </div>

              <div className="space-y-2 bg-slate-50/40 p-2 dark:bg-transparent">
                {activeGuide.disciplines.length ? (
                  activeGuide.disciplines.map((discipline) => (
                    <form
                      key={discipline.id}
                      action={updateGuideDisciplineAction}
                      className="grid grid-cols-12 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-primary/30 hover:shadow-sm dark:border-white/10 dark:bg-[#1c1630]"
                    >
                      <input type="hidden" name="disciplineId" value={discipline.id} />
                      <div className="col-span-12 lg:col-span-3">
                        <input
                          name="name"
                          defaultValue={discipline.name}
                          className="w-full border-none bg-transparent p-0 text-sm font-semibold text-slate-700 outline-none focus:ring-0 dark:text-white"
                        />
                      </div>

                      <div className="col-span-12 lg:col-span-3">
                        <input
                          name="category"
                          defaultValue={discipline.category ?? ""}
                          placeholder="Descricao"
                          className="w-full border-none bg-transparent p-0 text-xs text-slate-400 outline-none focus:ring-0 dark:text-slate-400"
                        />
                      </div>

                      <div className="col-span-12 text-center lg:col-span-2">
                        {discipline.subjectCount > 0 ? (
                          <span className="inline-flex items-center rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                            {discipline.subjectCount} materias vinculadas
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">
                            Sem vinculos
                          </span>
                        )}
                      </div>

                      <div className="col-span-12 flex items-center justify-end gap-2 lg:col-span-4">
                        <button className="rounded-md bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                          Salvar
                        </button>
                        <button
                          formAction={toggleGuideDisciplineAction}
                          name="disciplineId"
                          value={discipline.id}
                          className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            discipline.active
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                          }`}
                        >
                          {discipline.active ? "Ativa" : "Inativa"}
                        </button>
                        <button
                          type="submit"
                          formAction={deleteGuideDisciplineAction}
                          name="disciplineId"
                          value={discipline.id}
                          disabled={discipline.subjectCount > 0}
                          onClick={(event) => {
                            if (discipline.subjectCount > 0) {
                              event.preventDefault();
                              window.alert("Essa disciplina nao pode ser excluida porque ja possui materias vinculadas.");
                              return;
                            }
                            if (!window.confirm(`Excluir a disciplina "${discipline.name}"? Essa acao nao pode ser desfeita.`)) {
                              event.preventDefault();
                            }
                          }}
                          className="rounded-md bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500/10 dark:text-red-300"
                        >
                          Excluir
                        </button>
                      </div>
                    </form>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Este guia ainda nao tem materias. Adicione a primeira acima.
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <GuidePreview
            name={previewGuide.name}
            description={previewGuide.description}
            icon={previewGuide.icon}
            color={previewGuide.color}
            disciplines={previewGuide.disciplines}
          />
          <GuideList guides={guides} activeGuideId={activeGuideId} />
        </div>
      </div>
    </div>
  );
}
