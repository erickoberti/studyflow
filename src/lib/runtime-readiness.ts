import type { PrismaClient } from "@prisma/client";

const requiredMigrations = ["20261002120000_preserve_cycle_history", "20261002130000_standalone_without_cycle"];

export function runtimeConfigurationErrors(env: NodeJS.ProcessEnv) {
  const errors: string[] = [];
  const databaseUrl = env.DATABASE_URL;
  try {
    const url = new URL(databaseUrl ?? "");
    if (!(["postgres:", "postgresql:"].includes(url.protocol) && url.hostname && url.pathname.length > 1)) {
      errors.push("DATABASE_URL deve ser uma URL PostgreSQL válida.");
    }
  } catch {
    errors.push("DATABASE_URL deve ser uma URL PostgreSQL válida.");
  }
  if (env.NODE_ENV === "production") {
    if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET === "troque-por-uma-chave-secreta-longa" || env.NEXTAUTH_SECRET.length < 32) {
      errors.push("NEXTAUTH_SECRET deve ser definido com uma chave própria de pelo menos 32 caracteres.");
    }
    try {
      const url = new URL(env.NEXTAUTH_URL ?? "");
      if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
        errors.push("NEXTAUTH_URL deve usar HTTPS em produção.");
      }
    } catch {
      errors.push("NEXTAUTH_URL deve ser uma URL válida.");
    }
  }
  return errors;
}

export function assertRuntimeConfiguration(env: NodeJS.ProcessEnv) {
  const errors = runtimeConfigurationErrors(env);
  if (errors.length) throw new Error(`Configuração inválida: ${errors.join(" ")}`);
}

export async function assertDailyImportSchema(db: Pick<PrismaClient, "$queryRaw">) {
  const migrations = await db.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
    SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
    WHERE migration_name IN ('20261002120000_preserve_cycle_history', '20261002130000_standalone_without_cycle')
  `;
  const pending = requiredMigrations.filter((name) => !migrations.some((item) => item.migration_name === name && item.finished_at && !item.rolled_back_at));
  if (pending.length) {
    throw new Error(`Migração pendente: ${pending.join(", ")}`);
  }
  const columns = await db.$queryRaw<{ table_name: string; column_name: string; is_nullable: string }[]>`
    SELECT table_name, column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND ((table_name = 'StudySession' AND column_name IN ('subjectId', 'studyGuideId', 'cycleEntryId'))
        OR (table_name = 'SubjectProgress' AND column_name IN ('subjectId', 'studyGuideId')))
  `;
  const found = new Set(columns.map((item) => `${item.table_name}.${item.column_name}`));
  const required = ["StudySession.subjectId", "StudySession.studyGuideId", "StudySession.cycleEntryId", "SubjectProgress.subjectId", "SubjectProgress.studyGuideId"];
  if (required.some((column) => !found.has(column))) throw new Error("Schema incompatível com a importação diária.");
  if (columns.find((column) => column.table_name === "StudySession" && column.column_name === "cycleEntryId")?.is_nullable !== "YES") {
    throw new Error("StudySession.cycleEntryId deve aceitar registros sem ciclo.");
  }
}
