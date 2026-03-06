import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const raw = value.trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/").map(Number);
    return new Date(Date.UTC(yyyy, mm - 1, dd));
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00.000Z`);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getField(row: Record<string, string>, aliases: string[]) {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    map.set(normalizeKey(key), String(value ?? "").trim());
  }

  for (const alias of aliases) {
    const found = map.get(normalizeKey(alias));
    if (found !== undefined) return found;
  }

  return "";
}

function estimateMinutes(questions: number, weight: number) {
  const perQuestion = weight >= 2 ? 2 : 1.5;
  return Math.round(questions * perQuestion);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ message: "Arquivo ausente" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: text.includes(";") ? ";" : ",",
  });

  const rows = parsed.data;
  if (!rows.length) {
    return NextResponse.json({ ok: false, message: "Planilha vazia." }, { status: 400 });
  }

  let importedRows = 0;
  const importedTargets: number[] = [];

  for (const row of rows) {
    const date = parseDate(getField(row, ["Data"]));
    const disciplineName = getField(row, ["Disciplina"]);
    const subjectName = getField(row, ["Assunto"]);

    if (!date || !disciplineName || !subjectName) continue;

    const weight = parseNumber(getField(row, ["Peso"])) ?? 1;
    const questions = parseNumber(getField(row, ["Questões", "Questoes", "Quest", "Questo"])) ?? 0;
    const correct = parseNumber(getField(row, ["Acertos", "Acerto"])) ?? 0;
    let wrong = parseNumber(getField(row, ["Erros", "Erro"])) ?? 0;

    if (questions <= 0) continue;

    if (correct + wrong !== questions) {
      wrong = Math.max(0, questions - correct);
    }

    const percentage =
      parseNumber(getField(row, ["% Dia", "%Dia", "Percentual Dia", "Percentual"])) ??
      (questions > 0 ? (correct / questions) * 100 : 0);

    const target = parseNumber(getField(row, ["Meta %", "Meta%", "% Meta", "Meta"]));
    if (target !== null) importedTargets.push(target);

    const gapFromFile = parseNumber(getField(row, ["Gap (Meta - %)", "Gap (Meta-%)", "Gap", "Gap (Meta %) "]));
    const gap = gapFromFile ?? (target !== null ? target - percentage : null);
    const priority = getField(row, ["Prioridade", "Prioridade (Nível)", "Prioridade (Nivel)"]);

    const notes = [
      target !== null ? `Meta: ${target.toFixed(1)}%` : null,
      gap !== null ? `Gap: ${gap.toFixed(1)}%` : null,
      priority ? `Prioridade: ${priority}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

    const discipline = await prisma.discipline.upsert({
      where: {
        userId_name: {
          userId: session.user.id,
          name: disciplineName,
        },
      },
      update: { active: true },
      create: {
        userId: session.user.id,
        name: disciplineName,
        active: true,
        category: null,
      },
    });

    const subject = await prisma.subject.upsert({
      where: {
        userId_disciplineId_name: {
          userId: session.user.id,
          disciplineId: discipline.id,
          name: subjectName,
        },
      },
      update: {
        active: true,
        weight,
      },
      create: {
        userId: session.user.id,
        disciplineId: discipline.id,
        name: subjectName,
        weight,
        active: true,
      },
    });

    let cycleEntry = await prisma.cycleEntry.findFirst({
      where: { userId: session.user.id, subjectId: subject.id },
      orderBy: { orderIndex: "asc" },
    });

    if (!cycleEntry) {
      const last = await prisma.cycleEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: { orderIndex: "desc" },
      });

      cycleEntry = await prisma.cycleEntry.create({
        data: {
          userId: session.user.id,
          subjectId: subject.id,
          orderIndex: (last?.orderIndex ?? 0) + 1,
          active: true,
        },
      });
    }

    const estimatedMinutes = estimateMinutes(questions, weight);

    const exists = await prisma.studySession.findFirst({
      where: {
        userId: session.user.id,
        cycleEntryId: cycleEntry.id,
        date,
        questions,
        correct,
        wrong,
      },
    });

    if (!exists) {
      await prisma.studySession.create({
        data: {
          userId: session.user.id,
          cycleEntryId: cycleEntry.id,
          date,
          questions,
          correct,
          wrong,
          percentage,
          estimatedMinutes,
          notes,
        },
      });
      importedRows += 1;
    }
  }

  if (importedTargets.length) {
    const avgTarget = importedTargets.reduce((sum, value) => sum + value, 0) / importedTargets.length;
    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        targetPercentage: avgTarget,
      },
      update: {
        targetPercentage: avgTarget,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    importedRows,
    message: "Registro diário importado com sucesso.",
  });
}