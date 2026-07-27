import { ClipboardCheck } from "lucide-react";
import { MockExamManager } from "@/components/mock-exam-manager";
import { requireUser } from "@/lib/auth";
import { getPhaseFiveData } from "@/lib/phase-five-service";
import { requireActiveStudyGuide } from "@/lib/study-guide";

export default async function SimuladosPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const data = await getPhaseFiveData(user.id, guide.id);
  const exams = data.exams.map((exam) => ({ id: exam.id, title: exam.title, takenAt: exam.takenAt.toISOString(), durationMinutes: exam.durationMinutes, totalQuestions: exam.totalQuestions, correct: exam.correct, wrong: exam.wrong, percentage: exam.percentage, notes: exam.notes, results: exam.results.map((result) => ({ id: result.id, questions: result.questions, correct: result.correct, percentage: result.percentage, discipline: { name: result.discipline?.name ?? result.disciplineName } })) }));
  return <div className="space-y-7 pb-20">
    <header className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><ClipboardCheck /></span><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Simulados</h1><p className="mt-1 text-sm text-slate-500">Planeje a distribuição por peso, registre resultados e acompanhe sua evolução sem alterar o ciclo real.</p></div></header>
    <MockExamManager disciplines={data.weightedDisciplines} exams={exams} />
  </div>;
}
