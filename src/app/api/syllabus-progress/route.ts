import { NextResponse } from "next/server";
import { SyllabusStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveStudyGuide } from "@/lib/study-guide";

const schema = z.object({ subjectId: z.string().min(1), status: z.nativeEnum(SyllabusStatus), notes: z.string().trim().max(1000).optional() });

export async function PUT(request: Request) {
  const user = await requireUser();
  const guide = await requireActiveStudyGuide(user.id);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Status do edital inválido." }, { status: 400 });
  const subject = await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userId: user.id, studyGuideId: guide.id, active: true }, select: { id: true } });
  if (!subject) return NextResponse.json({ message: "Assunto não pertence ao guia ativo." }, { status: 404 });
  const completedAt = parsed.data.status === SyllabusStatus.COMPLETED ? new Date() : null;
  const progress = await prisma.syllabusProgress.upsert({
    where: { subjectId: subject.id },
    create: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, status: parsed.data.status, notes: parsed.data.notes || null, completedAt },
    update: { status: parsed.data.status, ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}), completedAt },
  });
  return NextResponse.json(progress);
}
