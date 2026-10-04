import assert from "node:assert/strict";
import test from "node:test";
import { assertDailyImportSchema, runtimeConfigurationErrors } from "../src/lib/runtime-readiness";
import type { PrismaClient } from "@prisma/client";

test("configuração distingue desenvolvimento e produção sem expor credenciais", () => {
  assert.deepEqual(runtimeConfigurationErrors({ NODE_ENV: "development", DATABASE_URL: "postgresql://localhost/test" }), []);
  const invalid = runtimeConfigurationErrors({ NODE_ENV: "production", DATABASE_URL: "invalid", NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "troque-por-uma-chave-secreta-longa" });
  assert.equal(invalid.length, 3);
  assert.deepEqual(runtimeConfigurationErrors({ NODE_ENV: "production", DATABASE_URL: "postgresql://host/db", NEXTAUTH_URL: "https://example.com", NEXTAUTH_SECRET: "a".repeat(32) }), []);
});

test("schema incompatível ou migração pendente bloqueiam a importação", async () => {
  const migrations = ["20261002120000_preserve_cycle_history", "20261002130000_standalone_without_cycle"].map((migration_name) => ({ migration_name, finished_at: new Date(), rolled_back_at: null }));
  const columns = ["StudySession.subjectId", "StudySession.studyGuideId", "StudySession.cycleEntryId", "SubjectProgress.subjectId", "SubjectProgress.studyGuideId"].map((item) => { const [table_name, column_name] = item.split("."); return { table_name, column_name, is_nullable: "YES" }; });
  let calls = 0;
  const db = { $queryRaw: async () => (++calls === 1 ? migrations : columns) } as unknown as Pick<PrismaClient, "$queryRaw">;
  await assertDailyImportSchema(db);
  calls = 0;
  const pending = { $queryRaw: async () => (++calls === 1 ? [] : columns) } as unknown as Pick<PrismaClient, "$queryRaw">;
  await assert.rejects(assertDailyImportSchema(pending), /Migração pendente/);
  calls = 0;
  const missingColumn = { $queryRaw: async () => (++calls === 1 ? migrations : columns.slice(1)) } as unknown as Pick<PrismaClient, "$queryRaw">;
  await assert.rejects(assertDailyImportSchema(missingColumn), /Schema incompatível/);
  calls = 0;
  const requiredColumn = { $queryRaw: async () => (++calls === 1 ? migrations : columns.map((column) => column.column_name === "cycleEntryId" ? { ...column, is_nullable: "NO" } : column)) } as unknown as Pick<PrismaClient, "$queryRaw">;
  await assert.rejects(assertDailyImportSchema(requiredColumn), /deve aceitar/);
});
