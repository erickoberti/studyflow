import { GuideManager } from "@/components/guide-manager";
import { requireUser } from "@/lib/auth";
import { getStudyGuidesWithDisciplines, STUDY_GUIDE_COLORS, STUDY_GUIDE_ICONS } from "@/lib/study-guide";

export default async function GuiasPage() {
  const user = await requireUser();
  const state = await getStudyGuidesWithDisciplines(user.id);

  const guides = state.guides.map((guide) => ({
    id: guide.id,
    name: guide.name,
    icon: guide.icon,
    color: guide.color,
    description: guide.description,
    disciplines: guide.disciplines.map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      category: discipline.category,
      active: discipline.active,
      subjectCount: discipline._count.subjects,
    })),
  }));

  return (
    <GuideManager
      guides={guides}
      activeGuideId={state.activeGuide?.id ?? ""}
      iconOptions={STUDY_GUIDE_ICONS}
      colorOptions={STUDY_GUIDE_COLORS}
    />
  );
}
