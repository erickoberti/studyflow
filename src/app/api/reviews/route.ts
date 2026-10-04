import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { ReviewStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";

const schema = z.object({ id: z.string(), action: z.enum(["complete", "postpone", "dismiss"]) });
export async function POST(request: Request) {
  const session = await getServerSession(authOptions); if (!session?.user?.id) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  const guide = await getActiveStudyGuideForUser(session.user.id); if (!guide) return NextResponse.json({ message: "Selecione um guia ativo." }, { status: 409 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  const review = await prisma.reviewSchedule.findFirst({ where: { id: parsed.data.id, userId: session.user.id, studyGuideId: guide.id, status: ReviewStatus.PENDING } });
  if (!review) return NextResponse.json({ message: "Revisão indisponível." }, { status: 404 });
  const now = new Date();
  const relatedDue = { userId: session.user.id, studyGuideId: guide.id, subjectId: review.subjectId, status: ReviewStatus.PENDING, OR: [{ dueAt: { lte: now } }, { id: review.id }] };
  if (parsed.data.action === "complete") await prisma.reviewSchedule.updateMany({ where: relatedDue, data: { status: ReviewStatus.COMPLETED, completedAt: now } });
  else if (parsed.data.action === "postpone") await prisma.reviewSchedule.updateMany({ where: relatedDue, data: { dueAt: new Date(now.getTime() + 86_400_000) } });
  else await prisma.reviewSchedule.update({ where: { id: review.id }, data: { status: ReviewStatus.DISMISSED, dismissedAt: now } });
  return NextResponse.json({ ok: true });
}
