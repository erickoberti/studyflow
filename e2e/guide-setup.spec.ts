import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = process.env.E2E_GUIDE_SETUP === "true"
  && databaseUrl?.hostname === "127.0.0.1" && databaseUrl?.port === "55439"
  && databaseUrl?.pathname === "/studyflow_release";

test.describe("cadastro e reativação de matérias", () => {
  test.skip(!isolated, "Exige o banco local isolado studyflow_release na porta 55439");
  test.use({ serviceWorkers: "block" });
  test.setTimeout(120_000);
  const prisma = new PrismaClient();
  let userId: string;
  let email: string;

  test.beforeEach(async ({ context }, info) => {
    email = `guide-setup-${info.project.name}-${Date.now()}@example.test`;
    const user = await prisma.user.create({ data: { name: "Validação de guias", email, passwordHash: "isolated-test-no-password-login", settings: { create: {} } } });
    userId = user.id;
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: userId, sub: userId, name: user.name, email }, maxAge: 1800 });
    await context.addCookies([
      { name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
      { name: "__Secure-next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: true },
    ]);
  });
  test.afterEach(async ({ page }) => {
    // Let background snapshot requests finish before removing their isolated account.
    await page.waitForLoadState("networkidle");
    await page.goto("about:blank");
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test("matéria aparece no painel, pausa, reativa e sincroniza criação offline sem duplicar", async ({ page, context }) => {
    await page.goto("/guias");
    await expect(page.getByPlaceholder("Ex.: Analista de TI - UERJ")).toHaveCount(1);
    await page.getByPlaceholder("Ex.: Analista de TI - UERJ").fill("Guia de validação");
    await page.getByRole("button", { name: "Criar guia", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Guia atual", exact: true })).toBeVisible();
    const addForm = page.locator("form").filter({ has: page.getByPlaceholder("Nova matéria") });
    await addForm.getByPlaceholder("Nova matéria").fill("Português");
    await addForm.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar Português", exact: true })).toBeEnabled();
    const guide = await prisma.studyGuide.findFirstOrThrow({ where: { userId, name: "Guia de validação" } });
    const where = { userId, studyGuideId: guide.id };
    const portuguese = await prisma.discipline.findFirstOrThrow({ where: { ...where, name: "Português" } });
    expect(await prisma.subject.count({ where })).toBe(1);
    expect(await prisma.cycleEntry.count({ where })).toBe(1);
    await page.goto("/dashboard");
    await expect(page.locator("#next-study-title")).toHaveText("Português");
    await expect(page.getByText("Estudo geral", { exact: true }).first()).toBeVisible();
    await page.goto("/ciclo");
    await expect(page.getByRole("heading", { name: /Português.*Estudo geral/ })).toBeVisible();
    await page.goto("/guias");
    await page.getByRole("button", { name: "Pausar Português", exact: true }).click();
    await expect(page.getByRole("button", { name: "Ativar Português", exact: true })).toBeEnabled();
    expect((await prisma.discipline.findUniqueOrThrow({ where: { id: portuguese.id } })).active).toBe(false);
    await page.reload();
    await page.getByRole("button", { name: "Ativar Português", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar Português", exact: true })).toBeEnabled();
    expect(await prisma.cycleEntry.count({ where })).toBe(1);
    expect(await prisma.subject.count({ where })).toBe(1);

    await prisma.discipline.create({ data: { ...where, name: "Matéria antiga", active: false } });
    await page.reload();
    await page.getByRole("button", { name: "Ativar Matéria antiga", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar Matéria antiga", exact: true })).toBeEnabled();
    expect(await prisma.cycleEntry.count({ where })).toBe(2);

    // Use the browser's cookie handling for the production Secure session cookie on loopback.
    const snapshot = await page.evaluate(async () => {
      const response = await fetch("/api/offline/bootstrap");
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Falha ao carregar o snapshot autenticado");
      return response.json();
    });
    await page.evaluate((saved) => {
      localStorage.setItem("studyflow-offline-snapshot", JSON.stringify(saved));
      localStorage.setItem("studyflow-offline-access", JSON.stringify({ email: saved.user.email, userId: saved.user.id, name: saved.user.name, unlockedAt: new Date().toISOString() }));
    }, snapshot);
    await page.goto("/offline/base");
    await expect(page.getByRole("heading", { name: "Disciplina offline" })).toBeVisible();
    await context.setOffline(true);
    await page.getByPlaceholder("Nome", { exact: true }).fill("Inglês offline");
    await page.getByRole("button", { name: "Criar disciplina", exact: true }).click();
    await expect(page.getByText("Inglês offline", { exact: true })).toBeVisible();
    await expect(page.getByText(/1 pendente\(s\) de envio/)).toBeVisible();
    await context.setOffline(false);
    await page.getByRole("button", { name: "Sincronizar", exact: true }).click();
    await expect(page.getByText(/pendente\(s\) de envio/)).toHaveCount(0);
    expect(await prisma.discipline.count({ where: { ...where, name: "Inglês offline" } })).toBe(1);
    expect(await prisma.subject.count({ where })).toBe(3);
    expect(await prisma.cycleEntry.count({ where })).toBe(3);
    const refreshed = page.waitForResponse((response) => response.url().endsWith("/api/offline/bootstrap") && response.status() === 200);
    await page.getByRole("button", { name: "Sincronizar", exact: true }).click();
    await (await refreshed).finished();
    await expect(page.getByRole("button", { name: "Sincronizar", exact: true })).toBeEnabled();
    expect(await prisma.cycleEntry.count({ where })).toBe(3);
  });

  test("recuperação de guia antigo mostra prévia e exclui matérias inativas", async ({ page }) => {
    const guide = await prisma.studyGuide.create({ data: { userId, name: "Guia antigo" } });
    await prisma.user.update({ where: { id: userId }, data: { activeStudyGuideId: guide.id } });
    const where = { userId, studyGuideId: guide.id };
    await prisma.discipline.createMany({ data: [{ ...where, name: "Português" }, { ...where, name: "Inglês", active: false }] });
    await page.goto("/guias");
    const notice = page.getByRole("region", { name: "Configuração do guia" });
    await notice.getByText("Montar ciclo com minhas matérias", { exact: true }).click();
    await expect(notice.getByRole("listitem")).toHaveText(["Português"]);
    await notice.getByRole("button", { name: "Montar ciclo e começar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("#next-study-title")).toHaveText("Português");
    expect(await prisma.subject.count({ where })).toBe(1);
    expect(await prisma.cycleEntry.count({ where })).toBe(1);
  });
});
