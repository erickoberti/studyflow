import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Visual and interaction checks are separate from the real service-worker E2E.
test.use({ serviceWorkers: "block" });

const screens = [["painel", "/dashboard"], ["estudar", "/registro"], ["ciclo", "/ciclo"], ["disciplinas", "/base"], ["historico", "/registros"], ["revisoes", "/revisao"]] as const;
const fixturePrisma = new PrismaClient();
let fixtureUserId = "";
test.beforeAll(async () => {
  expect(process.env.DATABASE_URL).toContain("127.0.0.1:55432/");
  const user = await fixturePrisma.user.create({ data: { name: "Aluno de teste", email: `stitch-${Date.now()}@example.test`, passwordHash: "unused-visual-fixture", settings: { create: {} } } });
  fixtureUserId = user.id;
  const guide = await fixturePrisma.studyGuide.create({ data: { userId: user.id, name: "Guia de validação visual" } });
  await fixturePrisma.user.update({ where: { id: user.id }, data: { activeStudyGuideId: guide.id } });
  for (const [index, item] of [["Banco de Dados", "Ferramentas Analytics: ETL, BI e Big Data"], ["Língua Inglesa", "Compreensão e gramática aplicada ao texto técnico"], ["Segurança da Informação", "Criptografia assimétrica e assinaturas digitais"], ["Redes de Computadores", "Arquitetura TCP/IP e protocolos de aplicação"]].entries()) {
    const discipline = await fixturePrisma.discipline.create({ data: { userId: user.id, studyGuideId: guide.id, name: item[0], sortOrder: index + 1, questionGoal: 20 } });
    const subject = await fixturePrisma.subject.create({ data: { userId: user.id, studyGuideId: guide.id, disciplineId: discipline.id, name: item[1], weight: index === 1 ? 1 : 2, notes: "Observação de teste: revisar conceitos e resolver questões comentadas." } });
    const entry = await fixturePrisma.cycleEntry.create({ data: { userId: user.id, studyGuideId: guide.id, disciplineId: discipline.id, subjectId: subject.id, orderIndex: index + 1 } });
    await fixturePrisma.studySession.create({ data: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, cycleEntryId: entry.id, date: new Date(Date.now() - index * 86_400_000), questions: 20, correct: 15, wrong: 5, percentage: 75, estimatedMinutes: 45, activityType: "QUESTIONS", scope: "CYCLE" } });
    await fixturePrisma.subjectProgress.create({ data: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, totalQuestions: 20, correct: 15, wrong: 5, averagePercentage: 75, lastStudiedAt: new Date() } });
    await fixturePrisma.reviewSchedule.create({ data: { userId: user.id, studyGuideId: guide.id, subjectId: subject.id, dueAt: new Date(Date.now() + (index < 2 ? -1 : 7) * 86_400_000), intervalDays: index < 2 ? 1 : 7 } });
  }
});
test.afterAll(async () => {
  if (fixtureUserId) await fixturePrisma.user.delete({ where: { id: fixtureUserId } });
  await fixturePrisma.$disconnect();
});
test("Stitch: seis telas, temas, navegação, filtros e ações em quatro apresentações", async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  expect(process.env.DATABASE_URL).toContain("127.0.0.1:55432/");
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({ where: { activeStudyGuideId: { not: null } }, select: { id: true, name: true, email: true, activeStudyGuideId: true, sessions: { select: { studyGuideId: true } } } });
  await prisma.$disconnect();
  const user = users.find((item) => item.id === fixtureUserId)!;
  expect(user).toBeTruthy();
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name, email: user.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  if (process.env.E2E_PRODUCTION === "true") await context.addCookies([{ name: "__Secure-next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: true }]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const variant of [
    { width: 1440, height: 900, theme: "light" }, { width: 1440, height: 900, theme: "dark" },
    { width: 390, height: 844, theme: "light" }, { width: 390, height: 844, theme: "dark" },
    { width: 360, height: 780, theme: "light" },
  ]) {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), variant.theme);
    for (const [name, route] of screens) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: name + " sem overflow em " + variant.width }).toBe(true);
      await expect(page.locator("main table:visible")).toHaveCount(0);
      const bg = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe(variant.theme === "dark" ? "rgb(12, 14, 21)" : "rgb(252, 248, 255)");
      if (variant.width === 1440) expect((await page.locator("aside").first().boundingBox())!.width).toBe(260);
      else { const nav = page.getByRole("navigation", { name: "Navegação móvel" }); await expect(nav).toBeVisible(); for (const link of await nav.getByRole("link").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(64); }
      if (name === "estudar") { await page.getByRole("tab", { name: "Questões", exact: true }).click(); await expect(page.getByRole("button", { name: "Registrar questões", exact: true })).toBeInViewport(); }
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      if (variant.width !== 360) await page.screenshot({ path: "artifacts/stitch/screenshots/" + name + "-" + variant.theme + "-" + variant.width + ".png", fullPage: false });
      if (name === "historico" && variant.width === 1440 && variant.theme === "light") {
        const filter = page.getByRole("textbox", { name: "Filtrar registros por disciplina, assunto ou data" });
        await filter.fill("__nenhum_assunto__"); await expect(page.getByText("Nenhum registro encontrado.")).toBeVisible(); await filter.fill("");
        const edit = page.getByRole("button", { name: "Editar", exact: true }).first(); if (await edit.count()) { await edit.click(); await expect(page.getByRole("button", { name: "Salvar alteração" })).toBeVisible(); await page.getByRole("button", { name: "Cancelar", exact: true }).click(); }
      }
    }
  }
  expect(errors).toEqual([]);
});

test("trilha do ciclo mantém manutenção e confirmação cancelável", async ({ page, context }) => {
  const user = await fixturePrisma.user.findUniqueOrThrow({ where: { id: fixtureUserId } });
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name, email: user.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  if (process.env.E2E_PRODUCTION === "true") await context.addCookies([{ name: "__Secure-next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: true }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ciclo");
  await page.waitForLoadState("networkidle");
  const maintenance = page.locator("main details").filter({ has: page.locator("summary", { hasText: /Gerenciar posição #1/ }) });
  await maintenance.locator("summary").click();
  await expect(maintenance).toHaveAttribute("open", "");
  for (const name of ["Subir", "Pausar", "Duplicar", "Excluir"]) await expect(maintenance.getByRole("button", { name, exact: true })).toBeVisible();
  await maintenance.getByRole("button", { name: "Excluir", exact: true }).click({ timeout: 10_000 });
  await expect(page.getByRole("alertdialog", { name: "Confirmar exclusão" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(maintenance.getByRole("button", { name: "Excluir", exact: true })).toBeFocused();
});

