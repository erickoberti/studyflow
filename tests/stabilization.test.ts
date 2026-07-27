import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

test("métricas diárias preservam minutos e o registro usa o recorte de hoje", () => {
  assert.match(source("src/lib/analytics.ts"), /estimatedMinutes/);
  assert.match(source("src/app/(app)/registro/page.tsx"), /todayData\?\.estimatedMinutes/);
});

test("ciclo usa cursor persistido e recorte da semana corrente", () => {
  const page = source("src/app/(app)/ciclo/page.tsx");
  assert.match(page, /studyGuideCycleState\.findUnique/);
  assert.match(page, /currentOrderIndex/);
  assert.match(page, /date:\s*\{\s*gte:\s*weekStart/);
});

test("dashboard da fase 5 usa agregados sem carregar o domínio completo", () => {
  const service = source("src/lib/phase-five-service.ts");
  const dashboard = service.slice(service.indexOf("export async function getPhaseFiveDashboard"));
  assert.doesNotMatch(dashboard, /getPhaseFiveData\(/);
  assert.match(dashboard, /mockExam\.aggregate/);
});

test("estados globais e observabilidade sanitizada estão instalados", () => {
  for (const file of [
    "src/app/(app)/loading.tsx",
    "src/app/(app)/error.tsx",
    "src/app/global-error.tsx",
    "src/app/not-found.tsx",
    "src/app/api/client-errors/route.ts",
    "src/lib/logger.ts",
  ]) assert.ok(existsSync(resolve(root, file)), `${file} deve existir`);

  const endpoint = source("src/app/api/client-errors/route.ts");
  assert.match(endpoint, /getServerSession/);
  assert.match(endpoint, /status: 401/);
  assert.doesNotMatch(endpoint, /stack/);
});

test("migrations versionadas permanecem aditivas", () => {
  const migrationsRoot = resolve(root, "prisma/migrations");
  for (const directory of readdirSync(migrationsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const sqlPath = resolve(migrationsRoot, directory.name, "migration.sql");
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, "utf8");
    assert.doesNotMatch(sql, /\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM)\b/i, `${directory.name} deve ser aditiva`);
  }
});

test("artefatos legados removidos não voltaram ao produto", () => {
  for (const file of ["prisma/init.sql", "public/icons/icon-192.svg", "public/icons/icon-512.svg"])
    assert.equal(existsSync(resolve(root, file)), false, `${file} deve permanecer removido`);
});
