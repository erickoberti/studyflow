import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { parseDailyImportDate, processDailyImportRecord, validDailyImportResults } from "@/lib/daily-import";
import { assertDailyImportSchema } from "@/lib/runtime-readiness";

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

function estimateMinutes(questions: number, weight: number) {
  const perQuestion = weight >= 2 ? 2 : 1.5;
  return Math.round(questions * perQuestion);
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

  try {
    await assertDailyImportSchema(prisma);
  } catch (error) {
    console.error("daily-import", { status: "schema-unavailable", reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, message: "Base incompatível ou migração pendente. A importação foi interrompida antes de gravar dados." }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ message: "Arquivo ausente" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseCsvRows(text);

  if (parsed.errors.length) return NextResponse.json({ ok: false, message: "CSV inválido; confira as colunas e aspas do arquivo." }, { status: 400 });

  const rows = parsed.data;
  if (!rows.length) {
    return NextResponse.json({ ok: false, message: "Planilha vazia." }, { status: 400 });
  }

  console.info("daily-import", { status: "started", rows: rows.length });

  let importedRows = 0;
  let updatedRows = 0;
  let validRows = 0;
  let skippedRows = 0;
  let invalidRows = 0;
  let conflictRows = 0;

  for (const row of rows) {
    const date = parseDailyImportDate(getField(row, ["Data"]));
    const disciplineName = getField(row, ["Disciplina"]);
    const subjectName = getField(row, ["Assunto"]);

    if (!date || !disciplineName || !subjectName) { invalidRows += 1; continue; }

    const rawWeight = getField(row, ["Peso"]);
    const rawQuestions = getField(row, ["Questoes", "Questões", "Quest", "Questo"]);
    const rawCorrect = getField(row, ["Acertos", "Acerto"]);
    const rawWrong = getField(row, ["Erros", "Erro"]);
    const weight = rawWeight ? parseNumber(rawWeight) : 1;
    const questions = rawQuestions ? parseNumber(rawQuestions) : 0;
    const correct = rawCorrect ? parseNumber(rawCorrect) : 0;
    const wrong = rawWrong ? parseNumber(rawWrong) : questions !== null && correct !== null ? Math.max(0, questions - correct) : null;

    if (weight === null || questions === null || correct === null || wrong === null || !Number.isInteger(weight) || weight <= 0 || !validDailyImportResults(questions, correct, wrong)) { invalidRows += 1; continue; }
    validRows += 1;

    const percentage = (correct / questions) * 100;

    const target = parseNumber(getField(row, ["Meta %", "Meta%", "% Meta", "Meta"]));

    const gapFromFile = parseNumber(getField(row, ["Gap (Meta - %)", "Gap (Meta-%)", "Gap", "Gap (Meta %) "]));
    const gap = gapFromFile ?? (target !== null ? target - percentage : null);
    const priority = getField(row, ["Prioridade", "Prioridade (Nivel)", "Prioridade (Nível)"]);

    const notes = [
      target !== null ? `Meta: ${target.toFixed(1)}%` : null,
      gap !== null ? `Gap: ${gap.toFixed(1)}%` : null,
      priority ? `Prioridade: ${priority}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

    const estimatedMinutes = estimateMinutes(questions, weight);
    try {
      let outcome: "inserted" | "updated" | "skipped" | "conflict" = "conflict";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          outcome = await prisma.$transaction((tx) => processDailyImportRecord(tx, {
            userId: session.user.id, studyGuideId: guide.id, disciplineName, subjectName, weight,
            date, questions, correct, wrong, percentage, estimatedMinutes, notes,
          }));
          break;
        } catch (error) {
          if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
        }
      }
      if (outcome === "inserted") importedRows += 1;
      else if (outcome === "updated") updatedRows += 1;
      else if (outcome === "skipped") skippedRows += 1;
      else conflictRows += 1;
    } catch {
      console.error("daily-import", { status: "failed", processed: validRows, inserted: importedRows, updated: updatedRows, skipped: skippedRows, invalid: invalidRows, conflicts: conflictRows });
      return NextResponse.json({ ok: false, importedRows, updatedRows, skippedRows, invalidRows, conflictRows, message: "Falha ao importar uma linha. As linhas anteriores foram preservadas; reenvie o arquivo para continuar sem duplicá-las." }, { status: 503 });
    }
  }

  if (!validRows) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Nenhuma linha válida encontrada. Use um CSV com colunas como: Data, Disciplina, Assunto, Peso, Questões, Acertos, Erros.",
      },
      { status: 400 },
    );
  }

  console.info("daily-import", { status: "complete", processed: rows.length, inserted: importedRows, updated: updatedRows, skipped: skippedRows, invalid: invalidRows, conflicts: conflictRows });
  const partial = invalidRows > 0 || conflictRows > 0;
  return NextResponse.json({
    ok: !partial,
    importedRows,
    updatedRows,
    skippedRows,
    invalidRows,
    conflictRows,
    message: partial
      ? `Importação parcial: ${importedRows} nova(s), ${updatedRows} atualizada(s), ${skippedRows} repetida(s), ${invalidRows} inválida(s) e ${conflictRows} com dados diferentes para o mesmo assunto e dia. Corrija as linhas pendentes antes de reenviar.`
      : `Registro diário processado: ${importedRows} linha(s) nova(s), ${updatedRows} atualizada(s) e ${skippedRows} já existente(s).`,
  }, { status: partial ? 207 : 200 });
}
