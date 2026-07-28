import type { Prisma } from "@prisma/client";

export const STUDY_TIME_ZONE = "America/Sao_Paulo";

export type StandaloneStudyInput = {
  userId: string;
  studyGuideId: string;
  disciplineId: string;
  subjectId: string;
  date: string;
  time: string;
  correct: number;
  wrong: number;
  estimatedMinutes: number;
  difficulty: "Fácil" | "Média" | "Difícil";
  notes?: string | null;
};

function zonedParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second") };
}

export function formatSaoPauloStudyInput(value: Date) {
  const parts = zonedParts(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return { date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`, time: `${pad(parts.hour)}:${pad(parts.minute)}` };
}

export function parseSaoPauloStudyDate(date: string, time: string, now = new Date()) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) throw new Error("Informe uma data e um horário válidos.");

  const desired = {
    year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]), minute: Number(timeMatch[2]), second: 0,
  };
  if (desired.month < 1 || desired.month > 12 || desired.day < 1 || desired.day > 31 || desired.hour > 23 || desired.minute > 59)
    throw new Error("Informe uma data e um horário válidos.");

  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, 0);
  let instant = new Date(desiredAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(instant);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    instant = new Date(instant.getTime() + desiredAsUtc - actualAsUtc);
  }

  const confirmed = zonedParts(instant);
  if (Object.entries(desired).some(([key, value]) => confirmed[key as keyof typeof confirmed] !== value))
    throw new Error("A data informada não existe no fuso horário de São Paulo.");
  if (instant.getTime() > now.getTime() + 60_000) throw new Error("A sessão não pode ser registrada em uma data futura.");
  return instant;
}

export function formatStandaloneNotes(difficulty: StandaloneStudyInput["difficulty"], notes?: string | null) {
  const detail = notes?.trim();
  return detail ? `[${difficulty}] ${detail}` : `[${difficulty}]`;
}

export async function createStandaloneStudySession(
  tx: Prisma.TransactionClient,
  input: StandaloneStudyInput,
  now = new Date(),
) {
  const questions = input.correct + input.wrong;
  if (questions <= 0) throw new Error("Informe ao menos um acerto ou erro.");
  if (input.correct < 0 || input.wrong < 0) throw new Error("Acertos e erros não podem ser negativos.");
  if (!Number.isInteger(input.estimatedMinutes) || input.estimatedMinutes <= 0) throw new Error("Informe uma duração válida em minutos.");

  const [guide, discipline, subject] = await Promise.all([
    tx.studyGuide.findFirst({ where: { id: input.studyGuideId, userId: input.userId }, select: { id: true } }),
    tx.discipline.findFirst({ where: { id: input.disciplineId, userId: input.userId, studyGuideId: input.studyGuideId, active: true }, select: { id: true } }),
    tx.subject.findFirst({ where: { id: input.subjectId, userId: input.userId, studyGuideId: input.studyGuideId, disciplineId: input.disciplineId, active: true }, select: { id: true } }),
  ]);
  if (!guide) throw new Error("Guia inválido ou sem acesso.");
  if (!discipline) throw new Error("Selecione uma disciplina ativa deste guia.");
  if (!subject) throw new Error("O assunto não pertence à disciplina selecionada ou está inativo.");

  // StudySession ainda mantém cycleEntryId obrigatório por compatibilidade histórica.
  // A entrada abaixo é apenas a âncora relacional; assunto, disciplina, data e métricas
  // vêm exclusivamente do registro avulso e o cursor nunca é alterado.
  const cycleEntry =
    await tx.cycleEntry.findFirst({ where: { userId: input.userId, studyGuideId: input.studyGuideId, disciplineId: input.disciplineId }, orderBy: { orderIndex: "asc" }, select: { id: true } })
    ?? await tx.cycleEntry.findFirst({ where: { userId: input.userId, studyGuideId: input.studyGuideId }, orderBy: { orderIndex: "asc" }, select: { id: true } });
  if (!cycleEntry) throw new Error("O guia precisa ter ao menos uma posição de ciclo para armazenar o histórico.");

  const sessionDate = parseSaoPauloStudyDate(input.date, input.time, now);
  const created = await tx.studySession.create({
    data: {
      userId: input.userId,
      studyGuideId: input.studyGuideId,
      cycleEntryId: cycleEntry.id,
      subjectId: subject.id,
      cyclePosition: null,
      cycleRound: null,
      date: sessionDate,
      questions,
      correct: input.correct,
      wrong: input.wrong,
      percentage: (input.correct / questions) * 100,
      estimatedMinutes: input.estimatedMinutes,
      notes: formatStandaloneNotes(input.difficulty, input.notes),
    },
    include: { subject: { include: { discipline: true } } },
  });
  const aggregate = await tx.studySession.aggregate({
    where: { userId: input.userId, studyGuideId: input.studyGuideId, subjectId: subject.id },
    _count: { id: true }, _sum: { questions: true, correct: true, wrong: true }, _max: { date: true },
  });
  const totalQuestions = aggregate._sum.questions ?? 0;
  const totalCorrect = aggregate._sum.correct ?? 0;
  await tx.subjectProgress.upsert({
    where: { subjectId: subject.id },
    create: {
      userId: input.userId, studyGuideId: input.studyGuideId, subjectId: subject.id,
      passages: aggregate._count.id, totalQuestions, correct: totalCorrect, wrong: aggregate._sum.wrong ?? 0,
      averagePercentage: totalQuestions ? totalCorrect / totalQuestions * 100 : 0, lastStudiedAt: aggregate._max.date,
    },
    update: {
      passages: aggregate._count.id, totalQuestions, correct: totalCorrect, wrong: aggregate._sum.wrong ?? 0,
      averagePercentage: totalQuestions ? totalCorrect / totalQuestions * 100 : 0, lastStudiedAt: aggregate._max.date,
    },
  });
  return created;
}
