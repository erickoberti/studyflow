import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";

function parseCsvRows(text: string) {
  return Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
}

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

function getFieldByIndex(row: Record<string, string>, headers: string[], index: number) {
  const header = headers[index];
  if (!header) return "";
  return String(row[header] ?? "").trim();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) {
    return NextResponse.json({ message: "Selecione um guia ativo" }, { status: 409 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ message: "Arquivo ausente" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseCsvRows(text);
  const rows = parsed.data;
  const headers = (parsed.meta.fields ?? []).map((field) => String(field ?? "").trim());

  if (!rows.length) {
    return NextResponse.json({ ok: false, message: "Planilha vazia." }, { status: 400 });
  }

  const ordered = rows
    .map((row) => ({
      seq:
        parseNumber(getField(row, ["Seq", "Sequencia", "Sequência", "Sequencia no ciclo", "Ordem"])) ??
        parseNumber(getFieldByIndex(row, headers, 0)),
      assunto:
        getField(row, ["Assunto", "Materia", "Matéria", "Topico", "Tópico"]) ||
        getFieldByIndex(row, headers, 1),
      peso: parseNumber(getField(row, ["Peso"])) ?? parseNumber(getFieldByIndex(row, headers, 2)) ?? 1,
      disciplina:
        getField(row, ["Disciplina", "Area", "Área", "Materia mae", "Matéria mãe"]) ||
        getFieldByIndex(row, headers, 3),
      tec:
        getField(row, ["Onde marcar no TEC", "Onde marcar no tec", "TEC", "Tec", "Referencia TEC", "Referência TEC"]) ||
        getFieldByIndex(row, headers, 4),
    }))
    .filter((row) => row.seq !== null && row.assunto && row.disciplina)
    .sort((a, b) => (a.seq as number) - (b.seq as number));

  if (!ordered.length) {
    return NextResponse.json(
      {
        ok: false,
        message: `Nenhuma linha válida encontrada. Use um CSV com colunas como: Seq, Assunto, Peso, Disciplina, Onde marcar no TEC. Cabeçalhos detectados: ${headers.join(" | ") || "nenhum"}.`,
      },
      { status: 400 },
    );
  }

  let importedRows = 0;
  const subjectOrderByDiscipline = new Map<string, number>();

  for (const item of ordered) {
    const subjectSortOrder = (subjectOrderByDiscipline.get(item.disciplina) ?? 0) + 1;
    subjectOrderByDiscipline.set(item.disciplina, subjectSortOrder);
    const discipline = await prisma.discipline.upsert({
      where: {
        userId_studyGuideId_name: {
          userId: session.user.id,
          studyGuideId: guide.id,
          name: item.disciplina,
        },
      },
      update: { active: true },
      create: {
        userId: session.user.id,
        studyGuideId: guide.id,
        name: item.disciplina,
        active: true,
        category: null,
      },
    });

    const subject = await prisma.subject.upsert({
      where: {
        userId_studyGuideId_disciplineId_name: {
          userId: session.user.id,
          studyGuideId: guide.id,
          disciplineId: discipline.id,
          name: item.assunto,
        },
      },
      update: {
        active: true,
        weight: item.peso,
        tecReference: item.tec || null,
        groupName: null,
        sortOrder: subjectSortOrder,
      },
      create: {
        userId: session.user.id,
        studyGuideId: guide.id,
        disciplineId: discipline.id,
        name: item.assunto,
        weight: item.peso,
        tecReference: item.tec || null,
        groupName: null,
        sortOrder: subjectSortOrder,
        active: true,
      },
    });

    await prisma.cycleEntry.upsert({
      where: {
        userId_studyGuideId_orderIndex: {
          userId: session.user.id,
          studyGuideId: guide.id,
          orderIndex: item.seq as number,
        },
      },
      update: {
        subjectId: subject.id,
        disciplineId: discipline.id,
        active: true,
      },
      create: {
        userId: session.user.id,
        studyGuideId: guide.id,
        subjectId: subject.id,
        disciplineId: discipline.id,
        orderIndex: item.seq as number,
        active: true,
      },
    });

    importedRows += 1;
  }

  if (!importedRows) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "O arquivo foi lido, mas nada novo foi importado. Verifique se as linhas já existem no guia atual ou se as colunas estão no formato esperado.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    importedRows,
    message: `Planilha importada com sucesso. ${importedRows} linha(s) processada(s) no guia atual.`,
  });
}
