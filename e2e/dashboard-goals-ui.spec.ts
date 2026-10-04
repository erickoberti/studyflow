import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Visual and interaction checks are separate from the real service-worker E2E.
test.use({ serviceWorkers: "block" });

test("dashboard e metas mantêm hierarquia, ação principal e controles em três larguras", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "O teste percorre as três larguras");
  test.skip(!process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET não configurado");

  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { activeStudyGuideId: { not: null } }, select: { id: true, name: true, email: true } });
  await prisma.$disconnect();
  test.skip(!user, "Nenhum usuário com guia ativo no banco isolado de teste");

  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user!.id, sub: user!.id, name: user!.name, email: user!.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  if (process.env.E2E_PRODUCTION === "true") await context.addCookies([{ name: "__Secure-next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: true }]);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible();
    const primaryAction = page.getByRole("link", { name: /Estudar agora|Retomar sessão|Importar matérias/ });
    await expect(primaryAction).toHaveAttribute("href", /\/(registro|base)/);
    await expect(page.getByRole("heading", { name: "Plano de hoje" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Indicadores de estudo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Atividade recente" })).toBeVisible();
    const nextStudyBox = (await page.locator('section[aria-labelledby="next-study-title"]').boundingBox())!;
    const planBox = (await page.locator('section[aria-labelledby="today-plan-title"]').boundingBox())!;
    const recentBox = (await page.locator('section[aria-labelledby="recent-studies-title"]').boundingBox())!;
    const performanceBox = (await page.locator('section[aria-labelledby="recent-performance-title"]').boundingBox())!;
    if (viewport.width === 1440) {
      expect(planBox.y).toBeGreaterThanOrEqual(nextStudyBox.y + nextStudyBox.height);
      expect(Math.abs(nextStudyBox.width - planBox.width)).toBeLessThan(2);
      expect(Math.abs(recentBox.y - performanceBox.y)).toBeLessThan(2);
    } else {
      expect(planBox.y).toBeGreaterThanOrEqual(nextStudyBox.y + nextStudyBox.height);
      expect(performanceBox.y).toBeGreaterThanOrEqual(recentBox.y + recentBox.height);
    }
    const primaryBox = (await primaryAction.boundingBox())!;
    expect(primaryBox.y + primaryBox.height).toBeLessThan(viewport.height);
    expect((await page.getByRole("region", { name: "Indicadores de estudo" }).boundingBox())!.y).toBeLessThan(viewport.height);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath(`dashboard-${viewport.width}.png`) });

    if (viewport.width === 1440) {
      await page.getByRole("button", { name: "Ativar modo escuro" }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(primaryAction).toBeVisible();
      if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath("dashboard-dark-1440.png") });
      await page.getByRole("button", { name: "Ativar modo claro" }).click();
      await primaryAction.click();
      await expect(page).toHaveURL(/\/(registro|base)(?:\?.*)?$/);
    }

    if (viewport.width === 820) continue;
    if (viewport.width === 390) {
      await page.getByRole("link", { name: "Ajustar plano" }).click();
      await expect(page).toHaveURL(/\/metas#ajustar-plano$/);
    } else await page.goto("/metas");
    await expect(page.getByRole("heading", { name: "Minhas metas" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tempo de estudo" })).toBeVisible();
    const adjust = page.locator("#ajustar-plano");
    await expect(adjust.locator("summary")).toBeVisible();
    if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath(`metas-${viewport.width}.png`) });
    await adjust.locator("summary").click();
    await expect(adjust.getByRole("button", { name: /Salvar minhas metas/ })).toBeVisible();
    await adjust.getByRole("button", { name: /Leve/ }).click();
    await expect(adjust.locator('input[name="dailyMinutes"]')).toHaveValue("45");
    await expect(adjust.locator('input[name="weeklyQuestions"]')).toHaveValue("100");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
