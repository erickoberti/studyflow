import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260723000000_baseline/migration.sql"), "utf8");

test("baseline cria o schema anterior à fase 1 com guarda e transação", () => {
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(migration, /pg_tables[\s\S]*RAISE EXCEPTION/);
  for (const table of ["User", "StudyGuide", "CycleEntry", "StudySession", "SubjectProgress", "StudyGuideCycleState"]) {
    assert.ok(migration.includes(`CREATE TABLE "${table}"`));
  }
  assert.ok(!migration.includes('CREATE TABLE "ActiveStudySession"'));
  assert.ok(!migration.includes('CREATE TYPE "StudySessionMode"'));
  assert.ok(!migration.includes('"activeStudySessionId"'));
  assert.doesNotMatch(migration, /\b(DROP TABLE|DELETE FROM|TRUNCATE)\b/);
});
