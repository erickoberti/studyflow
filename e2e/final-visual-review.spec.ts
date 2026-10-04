import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const authenticatedPages = [
  ["dashboard", "/dashboard"], ["estudar", "/registro"], ["ciclo", "/ciclo"],
  ["base", "/base"], ["historico", "/registros"], ["metas", "/metas"],
  ["planejamento", "/planejamento"], ["revisoes", "/revisao"],
  ["estatisticas", "/estatisticas"], ["simulados", "/simulados"],
  ["guias", "/guias"], ["configuracoes", "/configuracoes"],
] as const;

test("revisão visual final das páginas autenticadas em quatro larguras", async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(testInfo.project.name !== "desktop", "O teste percorre as quatro larguras");
  test.skip(!process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET não configurado");
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { activeStudyGuideId: { not: null } }, select: { id: true, name: true, email: true } });
  await prisma.$disconnect();
  test.skip(!user, "Nenhum usuário com guia ativo no banco isolado");
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user!.id, sub: user!.id, name: user!.name, email: user!.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 360, height: 780 }]) {
    await page.setViewportSize(viewport);
    for (const [name, path] of authenticatedPages) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), { message: `${name} em ${viewport.width}px sem overflow horizontal` }).toBe(true);
      if (["base", "historico"].includes(name) && viewport.width <= 390) await expect(page.locator("main table:visible")).toHaveCount(0);
      if (process.env.E2E_UI_SCREENSHOTS === "true" && ["dashboard", "estudar", "ciclo", "base", "historico", "metas"].includes(name) && [1440, 390].includes(viewport.width)) {
        await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
      }
      if (name === "estudar" && viewport.width === 390) await expect(page.getByRole("button", { name: "Registrar questões" })).toBeInViewport();
      if (name === "ciclo" && viewport.width === 390) {
        await expect(page.getByRole("link", { name: "Estudar agora" })).toBeInViewport();
        const position = page.locator("main details").filter({ has: page.locator("summary", { hasText: /Gerenciar posição/ }) }).first();
        if (await position.count()) {
          await position.locator("summary").click();
          await position.getByRole("button", { name: "Excluir" }).click();
          await expect(page.getByRole("alertdialog", { name: "Confirmar exclusão" })).toBeVisible();
          await page.getByRole("button", { name: "Cancelar" }).click();
        }
      }
    }
  }
});

test("login e cadastro compartilham marca, campos acessíveis e largura móvel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "O teste percorre as duas larguras");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const [name, path] of [["login", "/auth/login"], ["cadastro", "/auth/register"]] as const) {
      await page.goto(path);
      await expect(page.getByLabel("StudyFlow")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "E-mail" })).toBeVisible();
      await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
    }
  }
});

test("histórico preenchido mantém registro e ações legíveis no mobile", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "A largura é definida pelo teste");
  test.skip(!process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET não configurado");
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { activeStudyGuideId: { not: null }, sessions: { some: {} } },
    select: { id: true, name: true, email: true, activeStudyGuideId: true, sessions: { select: { studyGuideId: true } } },
  });
  await prisma.$disconnect();
  const user = users.find((candidate) => candidate.sessions.some((session) => session.studyGuideId === candidate.activeStudyGuideId));
  test.skip(!user, "Nenhum histórico no guia ativo da base isolada");
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user!.id, sub: user!.id, name: user!.name, email: user!.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/registros");
  await expect(page.locator("main table:visible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Excluir" }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath("historico-preenchido-390.png") });
});
