import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/components/forms/session-manager";
import { requireActiveStudyGuide } from "@/lib/study-guide";

export default async function RegistrosPage() {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);

  const [sessions, cycleEntries] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId: user.id, studyGuideId: guide.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        cycleEntry: {
          include: {
            subject: { include: { discipline: true } },
          },
        },
      },
    }),
    prisma.cycleEntry.findMany({
      where: { userId: user.id, studyGuideId: guide.id, active: true, subject: { active: true, discipline: { active: true } } },
      orderBy: { orderIndex: "asc" },
      include: { subject: { include: { discipline: true } } },
    }),
  ]);

  const safeSessions = sessions.map((s) => ({
    id: s.id,
    cycleEntryId: s.cycleEntryId,
    date: s.date.toISOString(),
    questions: s.questions,
    correct: s.correct,
    wrong: s.wrong,
    percentage: s.percentage,
    estimatedMinutes: s.estimatedMinutes,
    notes: s.notes ?? "",
    subjectName: s.cycleEntry.subject.name,
    disciplineName: s.cycleEntry.subject.discipline.name,
  }));

  const safeEntries = cycleEntries.map((e) => ({
    id: e.id,
    orderIndex: e.orderIndex,
    subjectName: e.subject.name,
    disciplineName: e.subject.discipline.name,
  }));

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Sessões de Estudo</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Corrija datas e dados antigos sem limitação dos últimos 5 registros.</p>
      </header>
      <SessionManager sessions={safeSessions} cycleEntries={safeEntries} />
    </div>
  );
}
