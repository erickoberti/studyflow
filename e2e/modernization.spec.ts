import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { createHash } from "node:crypto";

test.skip(process.env.STUDYFLOW_READ_ONLY_AUDIT !== "true", "Auditoria opcional da conta configurada: use npm run test:modernization.");

// Read-only audit. Do not submit forms or run seeds against an existing account.
test("telas autenticadas, navegação e responsividade preservam os dados", async ({ page, context }, testInfo) => {
  const db = new PrismaClient();
  try {
    const user = await db.user.findFirstOrThrow({ where: { activeStudyGuideId: { not: null } }, orderBy: { createdAt: "asc" } });
    const scope = { userId: user.id, studyGuideId: user.activeStudyGuideId! };
    const snapshot = async () => createHash("sha256").update(JSON.stringify(await Promise.all([
      db.studySession.findMany({ where: scope, orderBy: { id: "asc" } }),
      db.cycleEntry.findMany({ where: scope, orderBy: { id: "asc" } }),
      db.cycleProgram.findMany({ where: scope, include: { items: { orderBy: { id: "asc" }, include: { completion: true } } } }),
      db.subject.findMany({ where: scope, orderBy: { id: "asc" } }),
      db.studyGuideCycleState.findMany({ where: scope, orderBy: { id: "asc" } }),
      db.reviewSchedule.findMany({ where: scope, orderBy: { id: "asc" } }),
    ]))).digest("hex");
    const before = await snapshot();
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name, email: user.email }, maxAge: 3600 });
    await context.addCookies(["next-auth.session-token", "__Secure-next-auth.session-token"].map(name => ({ name, value: token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: name.startsWith("__Secure"), sameSite: "Lax" as const })));
    await context.addInitScript(() => localStorage.setItem("theme", "light"));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && /hydrat|formAction|unique.*key/i.test(message.text())) errors.push(message.text()); });
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ["dashboard", "ciclo", "ciclo/configuracao", "registro", "base", "registros", "revisao", "metas", "estatisticas", "planejamento", "simulados", "guias", "configuracoes", "mais"]) {
        await page.goto(`/${route}`);
        await expect(page.locator("main h1")).toHaveCount(1);
        await expect(page.getByText("Não foi possível carregar esta área")).toHaveCount(0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        expect(overflow, `${route} at ${width}px`).toBe(false);
        if (["dashboard", "ciclo", "registro", "base"].includes(route) && [1440, 390].includes(width)) await page.screenshot({ path: testInfo.outputPath(`${route}-${width}.png`), fullPage: true });
      }
    }
    await page.goto("/base");
    await page.getByLabel("Buscar matéria ou assunto").fill("zzzz-inexistente");
    await expect(page.getByRole("heading", { name: "Nenhum resultado" })).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await page.goto("/base?tab=assuntos&novo=1");
    await expect(page.getByLabel("Assunto principal", { exact: false })).toBeVisible();
    await page.getByLabel("Tópico no TecConcursos", { exact: true }).fill("SQL → JOIN");
    await page.getByLabel("Classificação", { exact: true }).selectOption("CONFIRMED");
    await page.getByLabel("Link direto do caderno", { exact: true }).fill("https://www.tecconcursos.com.br/cadernos/123");
    await expect(page.getByLabel("Classificação", { exact: true })).toHaveValue("SUGGESTED");
    await page.goto("/ciclo/configuracao");
    const roundSelect = page.getByLabel("Volta exibida", { exact: true });
    if (await roundSelect.isVisible()) await roundSelect.selectOption("0");
    const topic = page.getByLabel("Assunto da posição 1, volta 1", { exact: true });
    const original = await topic.inputValue();
    await topic.fill(`${original} (edição local de teste)`);
    await expect(page.locator("main").getByRole("status").filter({ hasText: "Alterações pendentes" })).toBeVisible();
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("link", { name: "← Voltar ao ciclo" }).click();
    await expect(page).toHaveURL(/\/ciclo\/configuracao$/);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("link", { name: "← Voltar ao ciclo" }).click();
    await expect(page).toHaveURL(/\/ciclo$/);
    await page.goto("/registros");
    await expect(page.getByRole("navigation", { name: "Navegação móvel" }).getByRole("link", { name: "Mais", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Navegação móvel" }).getByRole("link", { name: "Mais", exact: true }).click();
    await expect(page).toHaveURL(/\/mais$/);
    await expect(page.locator('nav[aria-label="Mais recursos"]').getByRole("link", { name: /Revisões/ })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("progressbar", { name: "Progresso semanal de questões" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revisões pendentes" })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Ativar modo escuro", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    for (const control of [page.locator("main .sf-primary").first(), page.locator("main .sf-secondary").first(), page.getByRole("link", { name: "Ver ciclo", exact: true })]) {
      await expect.poll(() => control.evaluate(element => {
        const luminance = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        let background = getComputedStyle(element).backgroundColor;
        let parent = element.parentElement;
        while (background === "rgba(0, 0, 0, 0)" && parent) { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
        const a = luminance(getComputedStyle(element).color), b = luminance(background);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      })).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({ path: testInfo.outputPath("dashboard-dark.png"), fullPage: true, animations: "disabled" });
    expect(errors).toEqual([]);
    expect(await snapshot()).toEqual(before);
  } finally { await db.$disconnect(); }
});

test("cronômetro, resultados e teclado funcionam com API simulada e sem gravar estudos", async ({ page, context }) => {
  const db = new PrismaClient();
  try {
    const user = await db.user.findFirstOrThrow({ where: { activeStudyGuideId: { not: null } }, orderBy: { createdAt: "asc" } });
    const scope = { userId: user.id, studyGuideId: user.activeStudyGuideId! };
    const before = await db.studySession.count({ where: scope });
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name }, maxAge: 3600 });
    await context.addCookies(["next-auth.session-token", "__Secure-next-auth.session-token"].map(name => ({ name, value: token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: name.startsWith("__Secure"), sameSite: "Lax" as const })));
    const data = await (await context.request.get("/api/active-study-session", { headers: { Cookie: `${process.env.E2E_PRODUCTION === "true" ? "__Secure-next-auth.session-token" : "next-auth.session-token"}=${token}` } })).json();
    test.skip(Boolean(data.session) || !data.suggestion, "Não interfere em uma sessão real aberta ou em um guia concluído.");
    const suggestion = data.suggestion;
    let session = { id: "ui-only-session", mode: "CYCLE", status: "ACTIVE", version: 1, startedAt: new Date().toISOString(), pausedAt: null as string | null, accumulatedSeconds: 0, cycle: { entryId: suggestion.entry.id, position: suggestion.entry.orderIndex, round: suggestion.roundNumber }, discipline: suggestion.entry.discipline, subject: { ...suggestion.subject, averagePercentage: 0, lastStudiedAt: null } };
    const commands: string[] = [];
    await page.route("**/api/active-study-session", async route => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      commands.push(body.command);
      if (body.command === "finish") { expect(body.questions).toBe(10); expect(body.correct).toBe(8); return route.fulfill({ json: { sessionId: "ui-only-result" } }); }
      session = { ...session, version: session.version + 1, status: body.command === "pause" ? "PAUSED" : "ACTIVE", accumulatedSeconds: body.command === "pause" ? 120 : session.accumulatedSeconds, pausedAt: new Date().toISOString() };
      await route.fulfill({ json: { session } });
    });
    // Any unrelated write is a test failure. Only the mock above may accept commands.
    const writes: string[] = [];
    page.on("request", request => { if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method()) && !request.url().endsWith("/api/active-study-session")) writes.push(request.url()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/registro?modo=timer");
    await page.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click();
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Iniciar cronômetro", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click();
    await page.getByRole("button", { name: "Finalizar e registrar", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Fechar", exact: true })).toBeFocused();
    await dialog.getByLabel("Acertos", { exact: true }).fill("8");
    await dialog.getByLabel("Erros", { exact: true }).fill("2");
    const save = dialog.getByRole("button", { name: "Salvar e concluir", exact: true });
    await save.focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Fechar", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(save).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Finalizar e registrar", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Finalizar e registrar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar e concluir", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(page.getByRole("heading", { name: "Registro concluído", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Continuar", exact: true })).toBeFocused();
    expect(commands).toEqual(["start", "pause", "resume", "finish"]);
    expect(writes).toEqual([]);
    expect(await db.studySession.count({ where: scope })).toBe(before);
  } finally { await db.$disconnect(); }
});
