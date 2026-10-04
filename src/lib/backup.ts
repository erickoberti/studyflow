import { Prisma } from "@prisma/client";

export const BACKUP_FORMAT = "studyflow-server-backup";
export const BACKUP_VERSION = 1;

// Parent records precede their children. Authentication and sync-ledger records are excluded.
export const BACKUP_MODELS = [
  "StudyGuide", "Discipline", "Subject", "CycleEntry", "UserSettings",
  "StudyGuideSettings", "StudyGuideCycleState", "ActiveStudySession", "StudySession",
  "ReviewSchedule", "SubjectProgress", "MockExam", "MockExamDisciplineResult",
  "SyllabusProgress", "DailyGoalSettings", "ManualDailyGoal", "ManualDailyGoalCheck",
  "DailyReflection",
] as const;

export type BackupModel = typeof BACKUP_MODELS[number];
type Row = Record<string, unknown>;
export type BackupData = Record<BackupModel, Row[]>;

export class InvalidBackupError extends Error {}

const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
const enums = new Map(Prisma.dmmf.datamodel.enums.map((item) => [item.name, new Set(item.values.map((value) => value.name))]));

const references: Partial<Record<BackupModel, Record<string, BackupModel>>> = {
  Discipline: { studyGuideId: "StudyGuide" },
  Subject: { studyGuideId: "StudyGuide", disciplineId: "Discipline" },
  CycleEntry: { studyGuideId: "StudyGuide", subjectId: "Subject", disciplineId: "Discipline" },
  StudyGuideSettings: { studyGuideId: "StudyGuide" },
  StudyGuideCycleState: { studyGuideId: "StudyGuide" },
  ActiveStudySession: { studyGuideId: "StudyGuide", cycleEntryId: "CycleEntry", disciplineId: "Discipline", subjectId: "Subject" },
  StudySession: { studyGuideId: "StudyGuide", cycleEntryId: "CycleEntry", subjectId: "Subject", activeStudySessionId: "ActiveStudySession" },
  ReviewSchedule: { studyGuideId: "StudyGuide", subjectId: "Subject", sourceSessionId: "StudySession" },
  SubjectProgress: { studyGuideId: "StudyGuide", subjectId: "Subject" },
  MockExam: { studyGuideId: "StudyGuide" },
  MockExamDisciplineResult: { mockExamId: "MockExam", disciplineId: "Discipline" },
  SyllabusProgress: { studyGuideId: "StudyGuide", subjectId: "Subject" },
  DailyGoalSettings: { studyGuideId: "StudyGuide" },
  ManualDailyGoal: { studyGuideId: "StudyGuide" },
  ManualDailyGoalCheck: { studyGuideId: "StudyGuide", manualGoalId: "ManualDailyGoal" },
  DailyReflection: { studyGuideId: "StudyGuide" },
};

function isObject(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validScalar(value: unknown, type: string, isList: boolean): boolean {
  if (isList) return Array.isArray(value) && value.every((item) => validScalar(item, type, false));
  if (enums.has(type)) return typeof value === "string" && enums.get(type)!.has(value);
  switch (type) {
    case "String": return typeof value === "string";
    case "Boolean": return typeof value === "boolean";
    case "Int": return typeof value === "number" && Number.isSafeInteger(value);
    case "Float": case "Decimal": return typeof value === "number" && Number.isFinite(value);
    case "DateTime": return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
    case "Json": return value !== undefined;
    default: return false;
  }
}

export function backupSelect(modelName: BackupModel) {
  const model = models.get(modelName);
  if (!model) throw new Error(`Modelo indisponível: ${modelName}`);
  return Object.fromEntries(model.fields.filter((field) => field.kind !== "object").map((field) => [field.name, true]));
}

export function validateBackup(raw: unknown, userId: string): { data: BackupData; activeStudyGuideId: string | null } {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT || raw.version !== BACKUP_VERSION) {
    throw new InvalidBackupError("Formato ou versão de backup incompatível.");
  }
  if (raw.accountId !== userId) throw new InvalidBackupError("O backup pertence a outra conta.");
  if (typeof raw.exportedAt !== "string" || Number.isNaN(Date.parse(raw.exportedAt))) throw new InvalidBackupError("Data de exportação inválida.");
  if (!isObject(raw.data) || Object.keys(raw.data).length !== BACKUP_MODELS.length) throw new InvalidBackupError("Backup incompleto.");
  if (raw.activeStudyGuideId !== null && typeof raw.activeStudyGuideId !== "string") throw new InvalidBackupError("Guia ativo inválido.");

  const data = {} as BackupData;
  const ids = new Map<BackupModel, Set<string>>();
  for (const name of BACKUP_MODELS) {
    const rows = raw.data[name];
    if (!Array.isArray(rows)) throw new InvalidBackupError(`Dados ausentes: ${name}.`);
    const fields = models.get(name)!.fields.filter((field) => field.kind !== "object");
    const allowed = new Set(fields.map((field) => field.name));
    const seen = new Set<string>();
    data[name] = rows.map((value) => {
      if (!isObject(value) || Object.keys(value).length !== fields.length || Object.keys(value).some((key) => !allowed.has(key))) {
        throw new InvalidBackupError(`Registro inválido em ${name}.`);
      }
      for (const field of fields) {
        const item = value[field.name];
        if (item === null ? field.isRequired : !validScalar(item, field.type, field.isList)) {
          throw new InvalidBackupError(`Campo inválido: ${name}.${field.name}.`);
        }
      }
      if ("userId" in value && value.userId !== userId) throw new InvalidBackupError(`Conta incompatível em ${name}.`);
      const id = value.id as string;
      if (!id || seen.has(id)) throw new InvalidBackupError(`ID repetido ou vazio em ${name}.`);
      seen.add(id);
      return value;
    });
    ids.set(name, seen);
  }

  if (raw.activeStudyGuideId && !ids.get("StudyGuide")!.has(raw.activeStudyGuideId)) throw new InvalidBackupError("Guia ativo ausente.");
  for (const name of BACKUP_MODELS) {
    for (const row of data[name]) {
      for (const [field, target] of Object.entries(references[name] ?? {})) {
        const id = row[field];
        if (id !== null && !ids.get(target)!.has(id as string)) throw new InvalidBackupError(`Referência ausente: ${name}.${field}.`);
      }
      if (name === "MockExamDisciplineResult") continue;
      const guideId = row.studyGuideId;
      if (typeof guideId === "string" && !ids.get("StudyGuide")!.has(guideId)) throw new InvalidBackupError(`Guia ausente em ${name}.`);
    }
  }
  return { data, activeStudyGuideId: raw.activeStudyGuideId as string | null };
}

export function restoreRows(data: BackupData, name: BackupModel) {
  const dates = new Set(models.get(name)!.fields.filter((field) => field.type === "DateTime").map((field) => field.name));
  return data[name].map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value !== null && dates.has(key) ? new Date(value as string) : value])));
}
