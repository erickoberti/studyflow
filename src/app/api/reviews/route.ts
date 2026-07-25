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
  const data = parsed.data.action === "complete" ? { status: ReviewStatus.COMPLETED, completedAt: new Date() } : parsed.data.action === "dismiss" ? { status: ReviewStatus.DISMISSED, dismissedAt: new Date() } : { dueAt: new Date(Date.now() + 86_400_000) };
  await prisma.reviewSchedule.update({ where: { id: review.id }, data });
  return NextResponse.json({ ok: true });
}
