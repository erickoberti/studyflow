import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const offlineSnapshot = {
  version: 2,
  user: { id: "user-e2e", name: "Aluno E2E", email: "e2e@studyflow.local" },
  guides: [{ id: "guide-e2e", serverId: "guide-e2e", name: "Guia E2E", icon: "book-open", color: "#895af6", description: "Teste local" }],
  activeGuideId: "guide-e2e",
  settings: { targetPercentage: 80, dailyQuestionsGoal: 30, weeklyQuestionsGoal: 200, weightPriorityBias: 1.25 },
  disciplines: [{ id: "discipline-e2e", serverId: "discipline-e2e", guideId: "guide-e2e", name: "Português", category: null, sortOrder: 1, active: true }],
  subjects: [{ id: "subject-e2e", serverId: "subject-e2e", guideId: "guide-e2e", disciplineId: "discipline-e2e", name: "Interpretação de textos", weight: 3, notes: null, tecReference: null, active: true, orderIndex: 1 }],
  cycleEntries: [{ id: "entry-e2e", serverId: "entry-e2e", guideId: "guide-e2e", subjectId: "subject-e2e", orderIndex: 1, active: true }],
  sessions: [], pendingOperations: [], lastSyncedAt: "2026-07-27T12:00:00.000Z",
};

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("rota protegida direciona para login acessível", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Google indisponível/ })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test("login offline retoma guia, ciclo e registro local", async ({ page }) => {
  await page.addInitScript((snapshot) => localStorage.setItem("studyflow-offline-snapshot", JSON.stringify(snapshot)), offlineSnapshot);
  await page.goto("/auth/login?mode=app");
  await page.getByLabel("E-mail").fill("e2e@studyflow.local");
  await page.getByRole("button", { name: "Entrar offline com dados salvos" }).click();
  await expect(page).toHaveURL(/\/offline\/dashboard/);
  await expect(page.getByRole("heading", { name: "Guia E2E" })).toBeVisible();
  await expect(page.getByText("Interpretação de textos")).toBeVisible();
  await page.getByRole("link", { name: "Ciclo" }).click();
  await expect(page).toHaveURL(/\/offline\/ciclo/);
  await page.getByRole("link", { name: "Registrar" }).click();
  await expect(page).toHaveURL(/\/offline\/registro/);
  await page.getByRole("button", { name: "Aula", exact: true }).click();
  await expect(page.getByLabel("Acertos")).toHaveCount(0);
  await expect(page.getByLabel("Erros")).toHaveCount(0);
  await expect(page.getByText("Tempo (min)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar aula localmente" })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("tema escuro e foco por teclado permanecem funcionais", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/auth/login");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("manifesto e service worker continuam disponíveis", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(await worker.text()).toContain("offline/dashboard");
});

test("áreas online principais carregam sem alterar dados", async ({ page, context }) => {
  test.skip(!process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET não configurado");
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { activeStudyGuideId: { not: null } }, select: { id: true, name: true, email: true } });
  await prisma.$disconnect();
  test.skip(!user, "Nenhum usuário com guia ativo disponível para auditoria somente leitura");
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user!.id, sub: user!.id, name: user!.name, email: user!.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  for (const [path, heading] of [["/dashboard", "Painel de Estudos"], ["/metas", "Metas"], ["/ciclo", "Meu Ciclo de Estudos"], ["/registro", "Estudar"], ["/simulados", "Simulados"], ["/planejamento", "Planejamento e edital"]] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText("Não foi possível carregar esta área")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
});
