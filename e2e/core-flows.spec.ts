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
  await page.getByRole("button", { name: "Videoaula", exact: true }).click();
  await expect(page.getByLabel("Acertos")).toHaveCount(0);
  await expect(page.getByLabel("Erros")).toHaveCount(0);
  await expect(page.getByText("Tempo (min)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar videoaula localmente" })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("PWA de produção mantém registro e fila após recarregar sem rede", async ({ page, context }) => {
  test.skip(process.env.E2E_PRODUCTION !== "true", "Exige build e service worker de produção");
  await page.addInitScript((snapshot) => localStorage.setItem("studyflow-offline-snapshot", JSON.stringify(snapshot)), offlineSnapshot);
  await page.goto("/auth/login?mode=app");
  await page.getByLabel("E-mail").fill("e2e@studyflow.local");
  await page.getByRole("button", { name: "Entrar offline com dados salvos" }).click();
  await expect(page).toHaveURL(/\/offline\/dashboard/);
  await page.goto("/offline/registro");
  await expect(page.getByRole("heading", { name: "Salvar sessão local" })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Salvar sessão local" })).toBeVisible();
  await page.getByRole("button", { name: "Videoaula", exact: true }).click();
  await page.getByRole("button", { name: "Salvar videoaula localmente" }).click();
  await expect(page.getByText(/pendente\(s\)/)).not.toContainText("0 pendente(s)");
  await page.reload();
  await expect(page.getByText(/pendente\(s\)/)).not.toContainText("0 pendente(s)");
});

for (const scenario of [
  { scope: "CYCLE", activityType: "QUESTIONS" },
  { scope: "CYCLE", activityType: "REVIEW" },
  { scope: "GENERAL", activityType: "REVIEW" },
]) {
  test(`edição de acertos e erros preserva resultados e ciclo: ${scenario.scope}/${scenario.activityType}`, async ({ page }) => {
    const snapshot = {
      ...offlineSnapshot,
      cycleCursor: { guideId: "guide-e2e", currentOrderIndex: 1 },
      sessions: [{
        id: "session-edit", serverId: "session-edit", ...scenario,
        cycleEntryId: scenario.scope === "CYCLE" ? "entry-e2e" : null,
        subjectId: scenario.scope === "CYCLE" ? "subject-e2e" : null,
        date: "2026-07-27T12:00:00.000Z", questions: 20, correct: 17, wrong: 3,
        percentage: 85, estimatedMinutes: 30, notes: "Registro para correção",
        createdAt: "2026-07-27T12:00:00.000Z", updatedAt: "2026-07-27T12:00:00.000Z",
        syncStatus: "synced", syncError: null,
      }],
    };
    await page.addInitScript((initial) => {
      const key = "studyflow-offline-snapshot:user-e2e";
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
      localStorage.setItem(`studyflow-offline-account:${encodeURIComponent("e2e@studyflow.local")}`, "user-e2e");
      localStorage.setItem("studyflow-offline-access", JSON.stringify({
        userId: "user-e2e", email: "e2e@studyflow.local", name: "Aluno E2E", unlockedAt: initial.lastSyncedAt,
      }));
    }, snapshot);
    await page.goto("/offline/registros");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.getByLabel("Acertos", { exact: true })).toHaveValue("17");
    await expect(page.getByLabel("Erros", { exact: true })).toHaveValue("3");
    const summary = page.locator('[aria-live="polite"]').filter({ hasText: "Total de questões:" });
    await expect(summary).toContainText("20");
    await expect(summary).toContainText("85.0%");

    for (const [field, value] of [["Acertos", "-1"], ["Acertos", "1.5"], ["Erros", "-1"], ["Erros", "1.5"]]) {
      await page.getByLabel(field, { exact: true }).fill(value);
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Editar registro local" })).toBeVisible();
      const unchanged = await page.evaluate(() => JSON.parse(localStorage.getItem("studyflow-offline-snapshot:user-e2e")!));
      expect(unchanged.sessions[0]).toMatchObject({ correct: 17, wrong: 3, questions: 20 });
      await page.getByLabel(field, { exact: true }).fill(field === "Acertos" ? "17" : "3");
    }

    await page.getByLabel("Erros", { exact: true }).fill("5");
    await expect(summary).toContainText("22");
    await expect(summary).toContainText("77.3%");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Editar registro local" })).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("studyflow-offline-snapshot:user-e2e")!));
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0]).toMatchObject({ correct: 17, wrong: 5, questions: 22, syncStatus: "pending_update", ...scenario });
    expect(saved.sessions[0].percentage).toBeCloseTo(17 / 22 * 100);
    expect(saved.cycleCursor).toEqual(snapshot.cycleCursor);

    await page.reload();
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.getByLabel("Acertos", { exact: true })).toHaveValue("17");
    await expect(page.getByLabel("Erros", { exact: true })).toHaveValue("5");
    await expect(summary).toContainText("77.3%");
    await expectNoHorizontalOverflow(page);
  });
}

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
  if (process.env.E2E_PRODUCTION === "true") await context.addCookies([{ name: "__Secure-next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: true }]);
  for (const [path, heading] of [["/dashboard", /^Olá,/], ["/metas", "Minhas metas"], ["/ciclo", "Sequência & Ritmo do Ciclo"], ["/registro", "Estudar"], ["/simulados", "Simulados"], ["/planejamento", "Planejamento e edital"]] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText("Não foi possível carregar esta área")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
});
