import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Visual and interaction checks are separate from the real service-worker E2E.
test.use({ serviceWorkers: "block" });

test("navegação e status permanecem acessíveis em desktop, tablet e mobile", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "O teste percorre os três tamanhos de tela");
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

    const sidebar = page.getByRole("navigation", { name: "Navegação principal" });
    const bottomNav = page.getByRole("navigation", { name: "Navegação móvel" });
    const activeNav = viewport.width >= 1024 ? sidebar : bottomNav;
    await expect(activeNav.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: /^Estado da conexão:/ })).toBeVisible();
    await expect(page.locator('summary[aria-label^="Guia ativo:"]:visible')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    if (viewport.width >= 1024) {
      await expect(sidebar).toBeVisible();
      await expect(bottomNav).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Atalhos principais" })).toHaveCount(0);
    } else {
      await expect(sidebar).toBeHidden();
      await expect(bottomNav).toBeVisible();
      for (const link of await bottomNav.getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
    }

    expect(await page.evaluate(() => {
      const header = document.querySelector("header")!.getBoundingClientRect();
      const status = document.querySelector<HTMLButtonElement>('button[aria-label^="Estado da conexão:"]')!.getBoundingClientRect();
      return status.top >= header.top && status.bottom <= header.bottom && status.right <= innerWidth;
    })).toBe(true);

    if (process.env.E2E_UI_SCREENSHOTS === "true") {
      await page.screenshot({ path: testInfo.outputPath(`dashboard-${viewport.width}.png`) });
    }

    if (viewport.width === 390) {
      await context.setOffline(true);
      const offlineStatus = page.getByRole("button", { name: /^Estado da conexão: Offline/ });
      await expect(offlineStatus).toBeVisible();
      await expect(offlineStatus).toHaveClass(/border-amber-300/);
      await expect.poll(() => offlineStatus.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(146, 64, 14)");
      if (process.env.E2E_UI_SCREENSHOTS === "true") {
        await page.screenshot({ path: testInfo.outputPath("dashboard-390-offline.png") });
      }
      await offlineStatus.click();
      await expect(page.getByRole("dialog", { name: "Sincronização e conflitos" })).toBeVisible();
      await page.getByRole("button", { name: "Fechar" }).click();
      await context.setOffline(false);
    }
  }
});
