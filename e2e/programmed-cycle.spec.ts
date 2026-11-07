import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { validateBackup } from "../src/lib/backup";

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(process.env.PROGRAM_CYCLE_INTEGRATION !== "true" || databaseUrl?.hostname !== "127.0.0.1" || databaseUrl.pathname !== "/studyflow_program_test", "Exige banco local fictício e PROGRAM_CYCLE_INTEGRATION=true.");

const db = new PrismaClient();
let userId = "", guideId = "";
let originalPositions: Awaited<ReturnType<typeof db.cycleEntry.findMany>>;

test.beforeAll(async () => {
  const user = await db.user.create({ data: { name: "Teste fictício de TI", email: `program-ui-${Date.now()}@example.test`, passwordHash: "not-a-login" } }); userId = user.id;
  const guide = await db.studyGuide.create({ data: { userId, name: "Programação fictícia" } }); guideId = guide.id;
  await db.user.update({ where: { id: userId }, data: { activeStudyGuideId: guideId } });
  const matter = await db.discipline.create({ data: { userId, studyGuideId: guideId, name: "Português" } });
  const subject = await db.subject.create({ data: { userId, studyGuideId: guideId, disciplineId: matter.id, name: "Conteúdo anterior" } });
  await db.cycleEntry.createMany({ data: Array.from({ length: 16 }, (_, index) => ({ userId, studyGuideId: guideId, disciplineId: matter.id, subjectId: subject.id, orderIndex: index + 1 })) });
  originalPositions = await db.cycleEntry.findMany({ where: { userId }, orderBy: { orderIndex: "asc" } });
  await db.studyGuideCycleState.create({ data: { userId, studyGuideId: guideId, currentOrderIndex: 5, roundNumber: 3 } });
  await db.studySession.create({ data: { userId, studyGuideId: guideId, cycleEntryId: originalPositions[0].id, subjectId: subject.id, scope: "CYCLE", cyclePosition: 1, date: new Date("2026-10-01"), questions: 10, correct: 7, wrong: 3, percentage: 70, estimatedMinutes: 20 } });
  await db.subjectProgress.create({ data: { userId, studyGuideId: guideId, subjectId: subject.id, totalQuestions: 10, correct: 7, wrong: 3, averagePercentage: 70, passages: 1 } });
});

test.afterAll(async () => {
  if (userId) {
    await db.cycleProgramCompletion.deleteMany({ where: { item: { program: { userId } } } });
    await db.studySession.deleteMany({ where: { userId } }); await db.activeStudySession.deleteMany({ where: { userId } });
    await db.cycleProgram.deleteMany({ where: { userId } }); await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
});

test("matriz requer confirmação, mantém histórico e deixa apenas 16 posições legíveis na tela principal", async ({ page, context }) => {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: userId, sub: userId, name: "Teste fictício" }, maxAge: 3600 });
  await context.addCookies(["next-auth.session-token", "__Secure-next-auth.session-token"].map(name => ({ name, value: token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: name.startsWith("__Secure"), sameSite: "Lax" as const })));
  // The API client does not send Secure cookies over local HTTP; browsers allow loopback.
  const apiCookie = `${process.env.E2E_PRODUCTION === "true" ? "__Secure-next-auth.session-token" : "next-auth.session-token"}=${token}`;
  const post = (path: string, data: unknown, headers: Record<string, string> = {}) => context.request.post(path, { data, headers: { Cookie: apiCookie, ...headers } });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const originalState = await db.studyGuideCycleState.findUnique({ where: { studyGuideId: guideId } });
  const originalHistory = await db.studySession.findMany({ where: { userId } });
  const originalProgress = await db.subjectProgress.findMany({ where: { userId } });
  const automaticWrites: string[] = [];
  const captureWrites = (request: { method(): string; url(): string }) => { if (request.method() === "POST") automaticWrites.push(request.url()); };
  page.on("request", captureWrites);
  await page.goto("/ciclo");
  await expect(page.getByRole("navigation", { name: "Mapa do ciclo" }).getByRole("link")).toHaveCount(16);
  await page.getByRole("link", { name: /^Posição 16:/ }).click();
  await expect(page).toHaveURL(/#cycle-position-16$/);
  await page.locator("#cycle-position-16 > details > summary").click();
  await expect(page.locator("#cycle-position-16").getByRole("button", { name: "Continuar daqui", exact: true })).toBeVisible();
  await page.goto("/ciclo/configuracao");
  await expect(page.getByRole("heading", { name: "Compare antes de ativar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar programação revisada" })).toBeDisabled();
  await expect(page.locator("tbody tr")).toHaveCount(16);
  await expect(page.locator("textarea")).toHaveCount(64);
  await expect(page.getByText("280 questões · 16 posições")).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(page.locator("textarea:visible")).toHaveCount(16);
  await page.getByLabel("Volta exibida", { exact: true }).selectOption("2");
  await expect(page.getByRole("textbox", { name: "Assunto da posição 1, volta 3", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar programação revisada" })).toBeDisabled();
  expect(await db.studyGuideCycleState.findUnique({ where: { studyGuideId: guideId } })).toEqual(originalState);
  expect(await db.studySession.findMany({ where: { userId } })).toEqual(originalHistory);
  expect(await db.subjectProgress.findMany({ where: { userId } })).toEqual(originalProgress);
  expect(automaticWrites).toEqual([]);
  page.off("request", captureWrites);
  await page.getByLabel("Volta exibida", { exact: true }).selectOption("0");
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await db.cycleProgram.count({ where: { userId } })).toBe(0);
  expect((await post("/api/cycle/program", {}, { Origin: "https://invalid.example" })).status()).toBe(403);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ativar programação revisada" }).click();
  await expect(page).toHaveURL(/\/ciclo$/);
  await expect(page.getByText("Seu roteiro · volta 1/4", { exact: true })).toBeVisible();
  await expect(page.getByText("Agora · posição 5/16 · volta 1/4")).toBeVisible();
  expect(await db.cycleEntry.findMany({ where: { userId }, orderBy: { orderIndex: "asc" } })).toEqual(originalPositions);
  expect(await db.studySession.count({ where: { userId } })).toBe(1);
  await page.getByRole("link", { name: "Ver e editar a matriz das voltas" }).click();
  await page.setViewportSize({ width: 390, height: 1000 });
  const firstTopic = page.getByRole("textbox", { name: "Assunto da posição 1, volta 1", exact: true });
  await firstTopic.fill("SELECT, WHERE e JOIN — assunto revisado e editável");
  await page.getByLabel("Volta exibida", { exact: true }).selectOption("1");
  await page.getByRole("textbox", { name: "Assunto da posição 1, volta 2", exact: true }).fill("Transações e isolamento — editado no celular");
  await page.getByLabel("Volta exibida", { exact: true }).selectOption("0");
  await expect(firstTopic).toHaveValue("SELECT, WHERE e JOIN — assunto revisado e editável");
  await expect(page.locator("textarea:visible")).toHaveCount(16);
  const matrix = page.getByRole("region", { name: "Matriz das quatro voltas" });
  expect(await matrix.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.locator("tbody tr").first().locator("td").first().locator("summary").click();
  await page.getByLabel("Tópico Tec 1:1", { exact: true }).fill("Nome sugerido, a conferir");
  await expect(page.getByLabel("Classificação Tec 1:1", { exact: true })).toHaveValue("SUGGESTED");
  await page.getByLabel("Link Tec 1:1", { exact: true }).fill("https://www.tecconcursos.com.br/questoes");
  await page.getByLabel("Classificação Tec 1:1", { exact: true }).selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Salvar programação", exact: true }).click();
  await expect(page).toHaveURL(/\/ciclo$/);
  expect(await db.cycleProgramItem.count({ where: { program: { userId }, roundNumber: 2, entryId: originalPositions[0].id, subject: { name: "Transações e isolamento — editado no celular" } } })).toBe(1);
  await page.locator("#cycle-position-16 > details > summary").click();
  await page.getByRole("button", { name: "Estudar posição 16", exact: true }).click();
  await expect(page.getByText("Agora · posição 16/16 · volta 1/4")).toBeVisible();
  const started = await post("/api/active-study-session", { command: "start", mode: "CYCLE", timerRunning: false });
  expect(started.status()).toBe(200); const active = (await started.json()).session;
  const finish = { command: "finish", id: active.id, version: active.version, questions: 20, correct: 10, minutes: 15 };
  expect((await post("/api/active-study-session", finish)).status()).toBe(200);
  expect((await (await post("/api/active-study-session", finish)).json()).idempotent).toBe(true);
  await page.reload();
  await expect(page.getByText("Seu roteiro · volta 1/4", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Progresso da volta", exact: true }).getByText("1/16 posições concluídas", { exact: true })).toBeVisible();
  expect(await db.studySession.count({ where: { userId } })).toBe(2);
  const backup = await (await context.request.get("/api/backup", { headers: { Cookie: apiCookie } })).json();
  expect(validateBackup(backup, userId).data.CycleProgramItem.length).toBe(64);
  const restored = await post("/api/backup", { ...backup, mode: "replace" });
  expect(restored.status()).toBe(200);
  expect(await db.studySession.count({ where: { userId } })).toBe(2);
  for (const width of [1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/ciclo");
    await expect(page.locator("#sequencia ol > li")).toHaveCount(16);
    await expect(page.locator("#sequencia > ol > li > details[open]")).toHaveCount(0);
    await expect(page.locator('#sequencia li[data-completed="true"]')).toHaveCount(1);
    const sequence = page.locator("#sequencia > ol");
    expect((await sequence.boundingBox())!.height).toBeLessThan(width < 768 ? 2100 : 1400);
    const beforeNavigation = await db.studyGuideCycleState.findUnique({ where: { studyGuideId: guideId } });
    await page.getByRole("link", { name: /^Posição 8:/ }).click();
    await expect(page.locator("#cycle-position-8")).toBeInViewport();
    expect(await db.studyGuideCycleState.findUnique({ where: { studyGuideId: guideId } })).toEqual(beforeNavigation);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `artifacts/program-cycle-${width}.png`, fullPage: true });
    await page.goto("/ciclo/configuracao");
    await expect(page.locator("textarea:visible")).toHaveCount(width < 768 ? 16 : 64);
    if (width < 768) {
      expect(await matrix.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.getByLabel("Volta exibida", { exact: true }).selectOption("1");
      await expect(page.getByRole("textbox", { name: "Assunto da posição 1, volta 2", exact: true })).toHaveValue("Transações e isolamento — editado no celular");
      await page.getByLabel("Volta exibida", { exact: true }).selectOption("0");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `artifacts/program-matrix-${width}.png` });
  }
  await page.goto("/registros");
  await expect(page.getByText("Conteúdo anterior", { exact: true }).first()).toBeVisible();
  await page.goto("/registro");
  await expect(page.getByText("Ciclo atual · volta 1/4")).toBeVisible();
  await page.goto("about:blank"); expect(errors).toEqual([]);
});
