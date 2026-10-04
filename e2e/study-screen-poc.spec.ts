import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Visual and interaction checks are separate from the real service-worker E2E.
test.use({ serviceWorkers: "block" });

test("tela Estudar apresenta assunto, modos e execução em desktop e mobile", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "O teste define as duas larguras");
  test.skip(!process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET não configurado");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { activeStudyGuideId: { not: null } },
    select: { id: true, name: true, email: true },
  });
  await prisma.$disconnect();
  test.skip(!user, "Nenhum usuário com guia ativo no banco isolado de teste");

  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user!.id, sub: user!.id, name: user!.name, email: user!.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  if (process.env.E2E_PRODUCTION === "true") await context.addCookies([{ name: "__Secure-next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: true }]);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/registro");
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    if (await page.getByRole("button", { name: "Cancelar", exact: true }).count()) {
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Estudar", exact: true })).toBeVisible();
    const subject = page.locator("#study-subject");
    await expect(subject).toBeVisible();
    let modeCommands = 0;
    const countModeCommands = (request: import("@playwright/test").Request) => { if (request.url().includes("/api/active-study-session") && request.method() === "POST") modeCommands += 1; };
    page.on("request", countModeCommands);
    for (const [mode, action] of [["Questões", "Registrar questões"], ["Conteúdo", "Registrar conteúdo"], ["Cronômetro", "Iniciar cronômetro"]]) {
      await page.getByRole("tab", { name: mode, exact: true }).click();
      await expect(page.getByRole("tab", { name: mode, exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel").getByRole("button", { name: action, exact: true })).toBeVisible();
      if (process.env.E2E_UI_SCREENSHOTS === "true" && mode !== "Questões") await page.screenshot({ path: testInfo.outputPath(`estudar-${mode === "Conteúdo" ? "conteudo" : "cronometro"}-${viewport.width}.png`) });
    }
    expect(modeCommands).toBe(0);
    page.off("request", countModeCommands);
    await page.getByRole("tab", { name: "Questões", exact: true }).click();
    await page.getByRole("tab", { name: "Questões", exact: true }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Cronômetro", exact: true })).toBeFocused();
    await page.getByRole("tab", { name: "Cronômetro", exact: true }).press("Home");
    await page.locator("#study-subject").click();
    await expect(page.getByRole("region", { name: "Progresso de hoje" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Contexto do assunto" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (viewport.width === 390) {
      const subjectBox = (await subject.boundingBox())!;
      const modesBox = (await page.getByLabel("Modos de estudo").boundingBox())!;
      const progressBox = (await page.getByRole("region", { name: "Progresso de hoje" }).boundingBox())!;
      expect(subjectBox.y).toBeLessThan(modesBox.y);
      expect(modesBox.y).toBeLessThan(progressBox.y);
      expect((await page.getByRole("button", { name: "Registrar questões" }).boundingBox())!.y).toBeLessThan(viewport.height);
    }
    if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath(`estudar-${viewport.width}.png`) });
    if (viewport.width === 1440) {
      await page.getByRole("button", { name: "Ativar modo escuro" }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath("estudar-dark-1440.png") });
      await page.getByRole("button", { name: "Ativar modo claro" }).click();
    }
  }

  await page.getByRole("tab", { name: "Conteúdo", exact: true }).click();
  await page.getByRole("button", { name: "Registrar conteúdo" }).click();
  const finishDialog = page.getByRole("dialog", { name: "Registre o que foi estudado" });
  await expect(finishDialog).toBeVisible();
  await expect(finishDialog.getByRole("button", { name: "Videoaula", exact: true })).toHaveAttribute("aria-pressed", "true");
  await finishDialog.getByRole("button", { name: "Fechar" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: "Registrar conteúdo" })).toBeEnabled();
  await page.reload();

  await page.getByRole("button", { name: "Registrar questões" }).click();
  await expect(finishDialog.getByRole("button", { name: "Questões", exact: true })).toHaveAttribute("aria-pressed", "true");
  await finishDialog.getByRole("button", { name: "Fechar" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: "Registrar questões" })).toBeEnabled();
  await page.reload();

  await page.getByRole("tab", { name: "Cronômetro", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar cronômetro" }).click();
  await expect(page.getByText("Tempo decorrido")).toBeVisible();
  if (process.env.E2E_UI_SCREENSHOTS === "true") await page.screenshot({ path: testInfo.outputPath("estudar-ativo-390.png") });
  await page.reload();
  await expect(page.getByText("Tempo decorrido")).toBeVisible();
  expect(pageErrors.filter((message) => message.includes("Hydration failed"))).toEqual([]);
  await page.getByRole("button", { name: "Modo foco" }).click();
  await expect(page.getByRole("button", { name: "Sair do foco" })).toBeVisible();
  await page.getByRole("button", { name: "Sair do foco" }).click();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Tempo medido")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: "Iniciar cronômetro" })).toBeVisible();
});
