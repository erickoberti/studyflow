import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const [guides, disciplines, subjects, cycleEntries, sessions, settings, guideSettings] = await Promise.all([
    prisma.studyGuide.findMany({ where: { userId: session.user.id } }),
    prisma.discipline.findMany({ where: { userId: session.user.id } }),
    prisma.subject.findMany({ where: { userId: session.user.id } }),
    prisma.cycleEntry.findMany({ where: { userId: session.user.id } }),
    prisma.studySession.findMany({ where: { userId: session.user.id } }),
    prisma.userSettings.findUnique({ where: { userId: session.user.id } }),
    prisma.studyGuideSettings.findMany({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      guides,
      disciplines,
      subjects,
      cycleEntries,
      sessions,
      settings,
      guideSettings,
    },
    {
      headers: {
        "Content-Disposition": "attachment; filename=studyflow-backup.json",
      },
    },
  );
}
