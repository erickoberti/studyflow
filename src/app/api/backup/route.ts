import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BACKUP_FORMAT, BACKUP_MODELS, BACKUP_VERSION, backupSelect, InvalidBackupError, restoreRows, validateBackup, type BackupModel } from "@/lib/backup";
import { recalculateSubjectProgress } from "@/lib/subject-progress";

type BackupDelegate = {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  deleteMany(args: object): Promise<unknown>;
  createMany(args: object): Promise<unknown>;
};

function delegate(db: Prisma.TransactionClient, name: BackupModel): BackupDelegate {
  const key = name[0].toLowerCase() + name.slice(1);
  return (db as unknown as Record<string, BackupDelegate>)[key];
}

function ownerFilter(name: BackupModel, userId: string) {
  return name === "MockExamDisciplineResult" ? { mockExam: { userId } } : { userId };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const userId = session.user.id;
  const backup = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { activeStudyGuideId: true } });
    const data: Record<string, unknown> = {};
    for (const name of BACKUP_MODELS) {
      data[name] = await delegate(tx, name).findMany({ where: ownerFilter(name, userId), select: backupSelect(name), orderBy: { id: "asc" } });
    }
    return { format: BACKUP_FORMAT, version: BACKUP_VERSION, accountId: userId, exportedAt: new Date().toISOString(), activeStudyGuideId: user.activeStudyGuideId, data };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 });

  return NextResponse.json(backup, { headers: { "Content-Disposition": "attachment; filename=studyflow-backup-v1.json", "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: "Origem inválida." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ message: "Envie JSON." }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > 10_000_000) return NextResponse.json({ message: "Backup excede 10 MB." }, { status: 413 });

  let parsed: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 10_000_000) return NextResponse.json({ message: "Backup excede 10 MB." }, { status: 413 });
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || (parsed as Record<string, unknown>).mode !== "replace") {
    return NextResponse.json({ message: "Informe mode: replace para substituir os dados da conta." }, { status: 400 });
  }

  let validated: ReturnType<typeof validateBackup>;
  try { validated = validateBackup(parsed, session.user.id); }
  catch (error) {
    if (error instanceof InvalidBackupError) return NextResponse.json({ message: error.message }, { status: 400 });
    throw error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pending = await tx.offlineOperation.count({ where: { userId: session.user.id, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
      if (pending) throw new InvalidBackupError("Há operações offline do servidor pendentes; sincronize ou resolva antes da restauração.");
      await tx.user.update({ where: { id: session.user.id }, data: { activeStudyGuideId: null } });
      await tx.offlineOperation.deleteMany({ where: { userId: session.user.id } });
      for (const name of [...BACKUP_MODELS].reverse()) await delegate(tx, name).deleteMany({ where: ownerFilter(name, session.user.id) });
      for (const name of BACKUP_MODELS) {
        const rows = restoreRows(validated.data, name);
        if (rows.length) await delegate(tx, name).createMany({ data: rows });
      }
      for (const guide of validated.data.StudyGuide) {
        const hasUnattributedHistory = validated.data.StudySession.some((row) => row.studyGuideId === guide.id && row.subjectId == null && row.scope !== "GENERAL");
        if (hasUnattributedHistory) continue;
        const subjectIds = validated.data.Subject.filter((subject) => subject.studyGuideId === guide.id).map((subject) => String(subject.id));
        await recalculateSubjectProgress(tx, session.user.id, String(guide.id), subjectIds);
      }
      await tx.user.update({ where: { id: session.user.id }, data: { activeStudyGuideId: validated.activeStudyGuideId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 10_000 });
  } catch (error) {
    if (error instanceof InvalidBackupError) return NextResponse.json({ message: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2014", "P2034"].includes(error.code)) {
      return NextResponse.json({ message: "Restauração cancelada por conflito de dados. Nenhuma alteração foi confirmada." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ restored: true, counts: Object.fromEntries(BACKUP_MODELS.map((name) => [name, validated.data[name].length])) }, { headers: { "Cache-Control": "no-store" } });
}
