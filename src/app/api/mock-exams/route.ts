import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";
import { summarizeMockExam } from "@/lib/phase-five";

const schema = z.object({
  title: z.string().trim().min(2).max(100),
  takenAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  notes: z.string().trim().max(2000).optional(),
  results: z.array(z.object({
    disciplineId: z.string().min(1),
    questions: z.coerce.number().int().min(0).max(1000),
    correct: z.coerce.number().int().min(0).max(1000),
  })).min(1),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Revise os dados do simulado.", issues: parsed.error.flatten() }, { status: 400 });
  const ids = parsed.data.results.map((item) => item.disciplineId);
  if (new Set(ids).size !== ids.length) return NextResponse.json({ message: "Cada disciplina deve aparecer apenas uma vez." }, { status: 400 });
  let summary;
  try { summary = summarizeMockExam(parsed.data.results); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Resultados inválidos." }, { status: 400 }); }
  const disciplines = await prisma.discipline.findMany({
    where: { id: { in: ids }, userId: user.id, studyGuideId: guide.id, active: true },
    include: { subjects: { where: { active: true }, select: { weight: true } } },
  });
  if (disciplines.length !== ids.length) return NextResponse.json({ message: "Uma disciplina não pertence ao guia ativo." }, { status: 400 });
  const byId = new Map(disciplines.map((item) => [item.id, item]));
  const exam = await prisma.mockExam.create({
    data: {
      userId: user.id,
      studyGuideId: guide.id,
      title: parsed.data.title,
      takenAt: parsed.data.takenAt,
      durationMinutes: parsed.data.durationMinutes,
      notes: parsed.data.notes || null,
      ...summary,
      results: { create: parsed.data.results.filter((item) => item.questions > 0).map((item) => {
        const discipline = byId.get(item.disciplineId)!;
        const weight = Math.max(1, discipline.subjects.reduce((sum, subject) => sum + Math.max(1, subject.weight), 0));
        return { disciplineId: item.disciplineId, disciplineName: discipline.name, weight, questions: item.questions, correct: item.correct, wrong: item.questions - item.correct, percentage: item.questions ? item.correct / item.questions * 100 : 0 };
      }) },
    },
    include: { results: { include: { discipline: { select: { name: true } } } } },
  });
  return NextResponse.json(exam, { status: 201 });
}
