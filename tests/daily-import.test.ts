import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { parseDailyImportDate, processDailyImportRecord, validDailyImportResults } from "../src/lib/daily-import";

test("datas e resultados inválidos são rejeitados sem corrigir silenciosamente", () => {
  assert.equal(parseDailyImportDate("31/02/2026"), null);
  assert.equal(parseDailyImportDate("2026-02-29"), null);
  assert.equal(parseDailyImportDate("02/10/2026")?.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(validDailyImportResults(10, 8, 2), true);
  assert.equal(validDailyImportResults(10, 8, 3), false);
  assert.equal(validDailyImportResults(10, 11, -1), false);
});

test("importação é idempotente, detecta conflito e recalcula após novo dia", async () => {
  const sessions: Array<{ id: string; subjectId: string | null; cycleEntryId: string | null; date: Date; questions: number; correct: number; wrong: number }> = [];
  const progress: number[] = [];
  const tx = {
    discipline: { findFirst: async () => ({ id: "discipline" }) },
    subject: { findFirst: async () => ({ id: "subject" }) },
    cycleEntry: { findFirst: async () => ({ id: "entry" }) },
    $queryRaw: async () => [{ id: "subject" }],
    studySession: {
      findMany: async ({ where }: { where: { date: { gte: Date; lt: Date } } }) => sessions.filter((item) => item.date >= where.date.gte && item.date < where.date.lt),
      create: async ({ data }: { data: typeof sessions[number] }) => { assert.equal(data.cycleEntryId, null); sessions.push({ ...data, id: String(sessions.length + 1) }); },
      update: async ({ where, data }: { where: { id: string }; data: { subjectId: string } }) => { const item = sessions.find((s) => s.id === where.id); if (item) item.subjectId = data.subjectId; },
      groupBy: async () => [{ subjectId: "subject", _count: { id: sessions.length }, _sum: { questions: sessions.reduce((n, s) => n + s.questions, 0), correct: sessions.reduce((n, s) => n + s.correct, 0), wrong: sessions.reduce((n, s) => n + s.wrong, 0) }, _max: { date: sessions.at(-1)?.date ?? null } }],
    },
    subjectProgress: { upsert: async ({ update }: { update: { totalQuestions: number } }) => { progress.push(update.totalQuestions); } },
  } as unknown as Prisma.TransactionClient;
  const input = { userId: "user", studyGuideId: "guide", disciplineName: "Direito", subjectName: "Tema", weight: 1, date: new Date("2026-10-02T00:00:00Z"), questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 15, notes: null };
  assert.equal(await processDailyImportRecord(tx, input), "inserted");
  assert.equal(await processDailyImportRecord(tx, input), "skipped");
  assert.equal(await processDailyImportRecord(tx, { ...input, correct: 7, wrong: 3, percentage: 70 }), "conflict");
  assert.equal(await processDailyImportRecord(tx, { ...input, date: new Date("2026-10-03T00:00:00Z") }), "inserted");
  assert.equal(sessions.length, 2);
  assert.deepEqual(progress, [10, 20]);
});

test("reexecução de registro legado preenche o assunto sem duplicar histórico", async () => {
  const legacy = { id: "old", subjectId: null as string | null, cycleEntryId: "entry", date: new Date("2026-10-02T00:00:00Z"), questions: 10, correct: 8, wrong: 2 };
  let recalculated = false;
  const tx = {
    discipline: { findFirst: async () => ({ id: "discipline" }) },
    subject: { findFirst: async () => ({ id: "subject" }) },
    cycleEntry: { findFirst: async () => ({ id: "entry" }) },
    $queryRaw: async () => [{ id: "subject" }],
    studySession: {
      findMany: async () => [legacy],
      update: async () => { legacy.subjectId = "subject"; },
      create: async () => { throw new Error("duplicação"); },
      groupBy: async () => [{ subjectId: "subject", _count: { id: 1 }, _sum: { questions: 10, correct: 8, wrong: 2 }, _max: { date: legacy.date } }],
    },
    subjectProgress: { upsert: async () => { recalculated = true; } },
  } as unknown as Prisma.TransactionClient;
  const result = await processDailyImportRecord(tx, { userId: "user", studyGuideId: "guide", disciplineName: "Direito", subjectName: "Tema", weight: 1, date: legacy.date, questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 15, notes: null });
  assert.equal(result, "updated");
  assert.equal(legacy.subjectId, "subject");
  assert.equal(recalculated, true);
});

test("assuntos homônimos em disciplinas distintas mantêm históricos separados", async () => {
  const sessions: Array<{ subjectId: string; date: Date; questions: number; correct: number; wrong: number }> = [];
  const tx = {
    discipline: { findFirst: async ({ where }: { where: { name: string } }) => ({ id: where.name }) },
    subject: { findFirst: async ({ where }: { where: { disciplineId: string } }) => ({ id: `subject-${where.disciplineId}` }) },
    cycleEntry: { findFirst: async () => null },
    $queryRaw: async () => [{ id: "subject-Direito" }, { id: "subject-TI" }],
    studySession: {
      findMany: async ({ where }: { where: { OR: Array<{ subjectId: string }>; date: { gte: Date; lt: Date } } }) => sessions.filter((item) => item.subjectId === where.OR[0].subjectId && item.date >= where.date.gte && item.date < where.date.lt),
      create: async ({ data }: { data: typeof sessions[number] }) => { sessions.push(data); },
      groupBy: async () => [],
    },
    subjectProgress: { upsert: async () => undefined },
  } as unknown as Prisma.TransactionClient;
  const input = { userId: "user", studyGuideId: "guide", subjectName: "Introdução", weight: 1, date: new Date("2026-10-02T00:00:00Z"), questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 15, notes: null };
  assert.equal(await processDailyImportRecord(tx, { ...input, disciplineName: "Direito" }), "inserted");
  assert.equal(await processDailyImportRecord(tx, { ...input, disciplineName: "TI" }), "inserted");
  assert.deepEqual(sessions.map((item) => item.subjectId), ["subject-Direito", "subject-TI"]);
  assert.equal(await processDailyImportRecord(tx, { ...input, disciplineName: "Direito" }), "skipped");
  assert.equal(sessions.length, 2);
});
