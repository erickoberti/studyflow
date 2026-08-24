import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGeneralReviewSession, createStandaloneStudySession, parseSaoPauloStudyDate, type StandaloneStudyInput } from "../src/lib/standalone-study-session";

const base: StandaloneStudyInput = {
  userId: "user-1", studyGuideId: "guide-1", disciplineId: "discipline-1", subjectId: "subject-1",
  date: "2026-07-20", time: "10:30", correct: 8, wrong: 2, estimatedMinutes: 20, difficulty: "Média", notes: "Revisar joins",
};

function fakeTransaction(options: { subject?: boolean } = {}) {
  const calls: Array<{ resource: string; args: unknown }> = [];
  let created: Record<string, unknown> | null = null;
  const tx = {
    studyGuide: { findFirst: async (args: unknown) => { calls.push({ resource: "guide", args }); return { id: "guide-1" }; } },
    discipline: { findFirst: async (args: unknown) => { calls.push({ resource: "discipline", args }); return { id: "discipline-1" }; } },
    subject: { findFirst: async (args: unknown) => { calls.push({ resource: "subject", args }); return options.subject === false ? null : { id: "subject-1" }; } },
    cycleEntry: { findFirst: async (args: unknown) => { calls.push({ resource: "cycleEntry", args }); return { id: "compat-entry" }; } },
    studySession: {
      create: async (args: { data: Record<string, unknown> }) => { calls.push({ resource: "studySession", args }); created = args.data; return { id: "session-1", ...args.data }; },
      aggregate: async (args: unknown) => { calls.push({ resource: "sessionAggregate", args }); return { _count: { id: 1 }, _sum: { questions: 10, correct: 8, wrong: 2 }, _max: { date: new Date("2026-07-20T13:30:00.000Z") } }; },
    },
    subjectProgress: { upsert: async (args: unknown) => { calls.push({ resource: "subjectProgress", args }); return {}; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls, get created() { return created; } };
}

test("converte data passada de São Paulo para o instante correto", () => {
  const value = parseSaoPauloStudyDate("2026-07-20", "10:30", new Date("2026-07-21T00:00:00Z"));
  assert.equal(value.toISOString(), "2026-07-20T13:30:00.000Z");
});

test("rejeita data futura e data inexistente", () => {
  assert.throws(() => parseSaoPauloStudyDate("2026-07-28", "10:00", new Date("2026-07-27T12:00:00Z")), /futura/);
  assert.throws(() => parseSaoPauloStudyDate("2026-02-30", "10:00", new Date("2026-07-27T12:00:00Z")), /não existe/);
});

test("persiste subjectId, guia, data, duração e resultados sem posição de ciclo", async () => {
  const fake = fakeTransaction();
  await createStandaloneStudySession(fake.tx, base, new Date("2026-07-27T12:00:00Z"));
  assert.deepEqual(fake.created, {
    userId: "user-1", studyGuideId: "guide-1", cycleEntryId: "compat-entry", subjectId: "subject-1", scope: "SUBJECT", cyclePosition: null, cycleRound: null,
    date: new Date("2026-07-20T13:30:00.000Z"), questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 20, activityType: "QUESTIONS", notes: "[Média] Revisar joins",
  });
  assert.equal(fake.calls.some((call) => call.resource === "studyGuideCycleState"), false);
  assert.match(JSON.stringify(fake.calls.find((call) => call.resource === "subjectProgress")), /2026-07-20T13:30:00.000Z/);
});

test("revisão geral contabiliza questões sem matéria, assunto ou ciclo", async () => {
  const fake = fakeTransaction();
  await createGeneralReviewSession(fake.tx, {
    userId: "user-1", studyGuideId: "guide-1", date: "2026-07-20", time: "10:30",
    correct: 34, wrong: 6, estimatedMinutes: 90, difficulty: "Média", notes: "Caderno misto do QConcursos",
  }, new Date("2026-07-27T12:00:00Z"));
  assert.deepEqual(fake.created, {
    userId: "user-1", studyGuideId: "guide-1", cycleEntryId: null, subjectId: null, scope: "GENERAL",
    cyclePosition: null, cycleRound: null, date: new Date("2026-07-20T13:30:00.000Z"),
    questions: 40, correct: 34, wrong: 6, percentage: 85, estimatedMinutes: 90,
    activityType: "REVIEW", notes: "[Média] Caderno misto do QConcursos",
  });
  assert.equal(fake.calls.some((call) => ["discipline", "subject", "cycleEntry", "subjectProgress"].includes(call.resource)), false);
});

test("revisão geral exige ao menos uma questão", async () => {
  const fake = fakeTransaction();
  await assert.rejects(() => createGeneralReviewSession(fake.tx, {
    userId: "user-1", studyGuideId: "guide-1", date: "2026-07-20", time: "10:30",
    correct: 0, wrong: 0, estimatedMinutes: 30, difficulty: "Fácil",
  }), /acerto ou erro/);
  assert.equal(fake.calls.some((call) => call.resource === "studySession"), false);
});

test("aula avulsa aceita zero questões e preserva o tempo estudado", async () => {
  const fake = fakeTransaction();
  await createStandaloneStudySession(fake.tx, { ...base, correct: 0, wrong: 0, activityType: "CLASS", estimatedMinutes: 45 }, new Date("2026-07-27T12:00:00Z"));
  assert.match(JSON.stringify(fake.created), /"activityType":"CLASS"/);
  assert.equal((fake.created as { questions: number }).questions, 0);
  assert.equal((fake.created as { estimatedMinutes: number }).estimatedMinutes, 45);
});

test("lei seca e PDF são registrados separadamente sem exigir questões", async () => {
  for (const activityType of ["READING", "PDF_READING"] as const) {
    const fake = fakeTransaction();
    await createStandaloneStudySession(fake.tx, { ...base, correct: 0, wrong: 0, activityType, estimatedMinutes: 35 }, new Date("2026-07-27T12:00:00Z"));
    assert.equal((fake.created as { activityType: string }).activityType, activityType);
    assert.equal((fake.created as { questions: number }).questions, 0);
    assert.equal((fake.created as { estimatedMinutes: number }).estimatedMinutes, 35);
  }
});

test("assunto inválido para a disciplina é rejeitado antes da persistência", async () => {
  const fake = fakeTransaction({ subject: false });
  await assert.rejects(() => createStandaloneStudySession(fake.tx, base), /não pertence à disciplina/);
  assert.equal(fake.calls.some((call) => call.resource === "studySession"), false);
});

test("consultas isolam usuário, guia, disciplina e somente registros ativos", async () => {
  const fake = fakeTransaction();
  await createStandaloneStudySession(fake.tx, base, new Date("2026-07-27T12:00:00Z"));
  const serialized = JSON.stringify(fake.calls);
  for (const value of ["user-1", "guide-1", "discipline-1", "subject-1", '"active":true']) assert.ok(serialized.includes(value), `${value} deve participar da validação`);
});

test("formulários só limpam resultados após sucesso e preservam falhas ou rascunhos offline", () => {
  const standalone = readFileSync(resolve(process.cwd(), "src/components/forms/study-session-form.tsx"), "utf8");
  const active = readFileSync(resolve(process.cwd(), "src/components/study/active-study-panel.tsx"), "utf8");
  assert.match(standalone, /if \(!response\.ok\) throw/);
  assert.ok(standalone.lastIndexOf("resetForm();") > standalone.indexOf("if (!response.ok) throw"));
  assert.match(active, /setCorrect\(local\.correct\)/);
  assert.match(active, /setWrong\(local\.wrong\)/);
  assert.ok((active.match(/clearFinishForm\(\)/g) ?? []).length >= 5);
});

test("finalização do ciclo calcula o total usando acertos e erros", () => {
  const active = readFileSync(resolve(process.cwd(), "src/components/study/active-study-panel.tsx"), "utf8");
  assert.match(active, /const questions = correct \+ wrong/);
  assert.doesNotMatch(active, /aria-label="Questões realizadas"/);
  assert.match(active, /<span>Total de questões<\/span><b>\{questions\}<\/b>/);
});

test("finalização oferece videoaula, lei seca e PDF como atividades contabilizáveis", () => {
  const active = readFileSync(resolve(process.cwd(), "src/components/study/active-study-panel.tsx"), "utf8");
  for (const activity of ["CLASS", "READING", "PDF_READING"]) assert.match(active, new RegExp(`setStudyActivity\\(\"${activity}\"\\)`));
  for (const label of ["Videoaula", "Lei seca", "PDF/material"]) assert.match(active, new RegExp(label));
});

test("analytics usa a data persistida e ignora avulso na progressão do ciclo", () => {
  const analytics = readFileSync(resolve(process.cwd(), "src/lib/analytics.ts"), "utf8");
  assert.match(analytics, /dayKey\(session\.date\)/);
  assert.match(analytics, /cyclePosition:\s*\{\s*not:\s*null\s*\}/);
  assert.match(analytics, /session\.cyclePosition !== null/);
});

test("formulário oferece revisão geral sem exigir disciplina e explica o impacto", () => {
  const form = readFileSync(resolve(process.cwd(), "src/components/forms/study-session-form.tsx"), "utf8");
  assert.match(form, /Revisão geral/);
  assert.match(form, /scope: "GENERAL"/);
  assert.match(form, /sem ser atribuído a uma matéria e sem avançar o ciclo/);
});
