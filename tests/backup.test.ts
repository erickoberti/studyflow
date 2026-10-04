import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { BACKUP_FORMAT, BACKUP_MODELS, BACKUP_VERSION, backupSelect, restoreRows, validateBackup } from "../src/lib/backup";

function emptyBackup() {
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, accountId: "user-1",
    exportedAt: "2026-10-02T12:00:00.000Z", activeStudyGuideId: null as string | null,
    data: Object.fromEntries(BACKUP_MODELS.map((name) => [name, []])) as Record<string, Record<string, unknown>[]>,
  };
}

test("backup cobre os modelos de dados da conta sem autenticação nem ledger", () => {
  assert.ok(BACKUP_MODELS.includes("StudySession"));
  assert.ok(BACKUP_MODELS.includes("DailyReflection"));
  assert.ok(BACKUP_MODELS.includes("MockExamDisciplineResult"));
  assert.ok(!BACKUP_MODELS.some((name) => ["User", "PasswordResetToken", "OfflineOperation"].includes(name)));
  assert.ok(!Object.keys(backupSelect("StudyGuide")).includes("user"));
  const owned = Prisma.dmmf.datamodel.models.filter((model) => model.fields.some((field) => field.name === "userId") && !["PasswordResetToken", "OfflineOperation"].includes(model.name)).map((model) => model.name).sort();
  assert.deepEqual([...BACKUP_MODELS].filter((name) => name !== "MockExamDisciplineResult").sort(), owned);
});

test("backup vazio versionado é válido e formatos antigos ou incompletos são recusados", () => {
  const backup = emptyBackup();
  assert.equal(validateBackup(backup, "user-1").data.StudyGuide.length, 0);
  assert.throws(() => validateBackup({ ...backup, version: 2 }, "user-1"), /incompatível/);
  assert.throws(() => validateBackup({ ...backup, data: { StudyGuide: [] } }, "user-1"), /incompleto/);
  assert.throws(() => validateBackup(backup, "user-2"), /outra conta/);
});

test("backup recusa campos inesperados, referências quebradas e datas inválidas", () => {
  const backup = emptyBackup();
  const guide = {
    id: "guide-1", userId: "user-1", name: "Guia", icon: "book-open", color: "#6366f1", description: null,
    createdAt: "2026-10-02T12:00:00.000Z", updatedAt: "2026-10-02T12:00:00.000Z",
  };
  backup.data.StudyGuide.push({ ...guide, passwordHash: "secret" });
  assert.throws(() => validateBackup(backup, "user-1"), /Registro inválido/);
  backup.data.StudyGuide[0] = { ...guide, createdAt: "invalid" };
  assert.throws(() => validateBackup(backup, "user-1"), /Campo inválido/);
  backup.data.StudyGuide[0] = guide;
  backup.activeStudyGuideId = "missing";
  assert.throws(() => validateBackup(backup, "user-1"), /Guia ativo ausente/);
  backup.activeStudyGuideId = "guide-1";
  const restored = validateBackup(backup, "user-1");
  assert.deepEqual(restored.activeStudyGuideId, "guide-1");
  assert.ok(restoreRows(restored.data, "StudyGuide")[0].createdAt instanceof Date);
});
