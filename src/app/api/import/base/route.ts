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

  const ordered = rows
    .map((row) => ({
      seq: parseNumber(getField(row, ["Seq", "Sequencia", "Sequência"])),
      assunto: getField(row, ["Assunto"]),
      peso: parseNumber(getField(row, ["Peso"])) ?? 1,
      disciplina: getField(row, ["Disciplina"]),
      tec: getField(row, ["Onde marcar no TEC", "Onde marcar no tec", "TEC", "Tec"]),
    }))
    .filter((r) => r.seq !== null && r.assunto && r.disciplina)
    .sort((a, b) => (a.seq as number) - (b.seq as number));

  let importedRows = 0;

  for (const item of ordered) {
    const discipline = await prisma.discipline.upsert({
      where: {
        userId_name: {
          userId: session.user.id,
          name: item.disciplina,
        },
      },
      update: { active: true },
      create: {
        userId: session.user.id,
        name: item.disciplina,
        active: true,
        category: null,
      },
    });

    const subject = await prisma.subject.upsert({
      where: {
        userId_disciplineId_name: {
          userId: session.user.id,
          disciplineId: discipline.id,
          name: item.assunto,
        },
      },
      update: {
        active: true,
        weight: item.peso,
        tecReference: item.tec || null,
        groupName: null,
      },
      create: {
        userId: session.user.id,
        disciplineId: discipline.id,
        name: item.assunto,
        weight: item.peso,
        tecReference: item.tec || null,
        groupName: null,
        active: true,
      },
    });

    await prisma.cycleEntry.upsert({
      where: {
        userId_orderIndex: {
          userId: session.user.id,
          orderIndex: item.seq as number,
        },
      },
      update: {
        subjectId: subject.id,
        active: true,
      },
      create: {
        userId: session.user.id,
        subjectId: subject.id,
        orderIndex: item.seq as number,
        active: true,
      },
    });

    importedRows += 1;
  }

  return NextResponse.json({
    ok: true,
    importedRows,
    message: "Planilha cadastrada com sucesso.",
  });
}