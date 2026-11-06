import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Read-only checks against the configured account; never submit a data mutation.
test("sequência completa e matéria → assunto são legíveis em todos os tamanhos", async ({ page, context, baseURL }, testInfo) => {
  const db = new PrismaClient();
  const fixture = await (async () => {
    try {
      const user = await db.user.findFirstOrThrow({ where: { activeStudyGuideId: { not: null } }, orderBy: { createdAt: "asc" } });
      const scope = { userId: user.id, studyGuideId: user.activeStudyGuideId! };
      const [entries, subjects] = await Promise.all([
        db.cycleEntry.findMany({ where: scope, orderBy: { orderIndex: "asc" } }),
        db.subject.findMany({ where: scope, include: { discipline: true } }),
      ]);
      return { user, entries, subjects };
    } finally { await db.$disconnect(); }
  })();
  const { user, entries, subjects } = fixture;
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name, email: user.email }, maxAge: 3600 });
  await context.addCookies(["next-auth.session-token", "__Secure-next-auth.session-token"].map(name => ({ name, value: token, domain: new URL(baseURL!).hostname, path: "/", httpOnly: true, secure: name.startsWith("__Secure"), sameSite: "Lax" as const })));
  await context.addInitScript(() => localStorage.setItem("theme", localStorage.getItem("ux-theme") ?? "light"));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  for (const width of [1440, 820, 390, 320, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ciclo");
    await expect(page.getByRole("heading", { name: "Ciclo de estudos", exact: true })).toBeVisible();
    expect(await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(247, 247, 242)");
    const rows = page.locator("#sequencia ol > li");
    await expect(rows).toHaveCount(entries.length);
    expect(await rows.locator(":scope > span:first-child").allTextContents()).toEqual(entries.map(entry => String(entry.orderIndex)));
    if (entries.length) {
      await expect(page.locator('li[aria-current="step"]')).toHaveCount(1);
      await expect(page.getByRole("progressbar", { name: "Percurso da volta" })).toBeVisible();
      const menu = rows.first().locator("details");
      await menu.locator("summary").click();
      await expect(menu.getByRole("button", { name: "Duplicar", exact: true })).toBeVisible();
      await menu.getByRole("button", { name: "Excluir", exact: true }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await menu.locator("summary").click();
    }
    expect(await rows.locator("p").evaluateAll(elements => elements.every(element => getComputedStyle(element).whiteSpace !== "nowrap" && element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`cycle-${width}.png`), fullPage: true });

    await page.goto("/base");
    await expect(page.getByRole("heading", { name: "Matérias e assuntos", exact: true })).toBeVisible();
    await expect(page.locator("main article[aria-label]")).toHaveCount(subjects.length);
    if (subjects.length) {
      const subject = subjects[0];
      const search = page.getByRole("textbox", { name: "Buscar matéria ou assunto" });
      await search.fill(subject.name);
      await expect(page.getByRole("article", { name: `${subject.discipline.name} → ${subject.name}`, exact: true })).toBeVisible();
      await search.fill("zzzz-sem-resultado-ux");
      await expect(page.getByRole("heading", { name: "Nenhum resultado" })).toBeVisible();
      await page.getByRole("button", { name: "Limpar filtros" }).click();
      await expect(page.locator("main article[aria-label]")).toHaveCount(subjects.length);
      await page.getByRole("combobox", { name: "Filtrar por matéria" }).selectOption(subject.disciplineId);
      await expect(page.locator("main article[aria-label]")).toHaveCount(subjects.filter(item => item.disciplineId === subject.disciplineId).length);
      await expect(page.getByRole("region", { name: `Progresso de ${subject.discipline.name}`, exact: true })).toBeVisible();
      await page.getByRole("combobox", { name: "Filtrar por matéria" }).selectOption("");
      await page.getByRole("button", { name: "Peso 2+", exact: true }).click();
      await expect(page.locator("main article[aria-label]")).toHaveCount(subjects.filter(item => item.weight >= 2).length);
      await page.getByRole("button", { name: "Todos", exact: true }).click();
    }
    expect(await page.locator("main article h2").evaluateAll(elements => elements.every(element => getComputedStyle(element).whiteSpace !== "nowrap" && element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`subjects-${width}.png`) });
  }
  for (const route of ["ciclo", "base", "dashboard", "registro"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${route}`);
    await page.evaluate(() => localStorage.setItem("ux-theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${route}-dark-mobile.png`) });
  }
  await page.goto("/base?tab=disciplinas&novo=1");
  await expect(page.getByRole("button", { name: "Criar matéria", exact: true })).toBeVisible();
  await page.goto("/base?tab=assuntos&novo=1");
  await expect(page.getByRole("button", { name: "Criar assunto", exact: true })).toBeVisible();
  await page.goto("/base?import=1");
  await expect(page.getByRole("heading", { name: "Importar cadastro-base" })).toBeVisible();
  await page.goto("/ciclo");
  await page.getByRole("link", { name: "Continuar estudo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Estudar", exact: true })).toBeAttached();
  expect(errors).toEqual([]);
});

test("ciclo local mantém a sequência e nomes longos legíveis no celular", async ({ page, context }) => {
  const subjectName = "UML e metodologias ágeis: diagramas de sequência, casos de uso e modelagem de sistemas distribuídos";
  const snapshot = {
    version: 2, user: { id: "ux-local", name: "Leitura local", email: "ux@example.test" },
    guides: [{ id: "ux-guide", serverId: "ux-guide", name: "Guia local", icon: "book-open", color: "#4648d4", description: null }],
    activeGuideId: "ux-guide", settings: null,
    disciplines: [{ id: "ux-matter", serverId: "ux-matter", guideId: "ux-guide", name: "Engenharia de Software", category: null, sortOrder: 1, active: true }],
    subjects: [{ id: "ux-topic", serverId: "ux-topic", guideId: "ux-guide", disciplineId: "ux-matter", name: subjectName, weight: 2, notes: null, tecReference: null, active: true, orderIndex: 1 }],
    cycleEntries: Array.from({ length: 8 }, (_, index) => ({ id: `ux-entry-${index}`, serverId: null, guideId: "ux-guide", subjectId: "ux-topic", orderIndex: index + 1, active: true })),
    sessions: [], pendingOperations: [], lastSyncedAt: null,
  };
  await context.addInitScript(saved => {
    localStorage.setItem("studyflow-offline-snapshot", JSON.stringify(saved));
    localStorage.setItem("studyflow-offline-access", JSON.stringify({ userId: saved.user.id, email: saved.user.email, name: saved.user.name, unlockedAt: new Date().toISOString() }));
  }, snapshot);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/offline/ciclo");
  const list = page.getByRole("region", { name: "Sequência salva offline" }).getByRole("listitem");
  await expect(list).toHaveCount(8);
  await expect(list.first()).toContainText(`Engenharia de Software → ${subjectName}`);
  expect(await list.locator("p").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
