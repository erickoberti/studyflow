import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

// Visual and interaction checks are separate from the real service-worker E2E.
test.use({ serviceWorkers: "block" });


const fixturePrisma = new PrismaClient();
let fixtureUserId = "";
test.beforeAll(async () => {
  expect(process.env.DATABASE_URL).toContain("127.0.0.1:55432/");
  const user = await fixturePrisma.user.create({ data: { name: "Aluno de teste", email: `stitch-${Date.now()}@example.test`, passwordHash: "unused-visual-fixture", settings: { create: {} } } });
  fixtureUserId = user.id;
  const guide = await fixturePrisma.studyGuide.create({ data: { userId: user.id, name: "Guia de validação visual" } });
  await fixturePrisma.user.update({ where: { id: user.id }, data: { activeStudyGuideId: guide.id } });
  for (const [index, item] of [["Banco de Dados", "Ferramentas Analytics"], ["Língua Inglesa", "Compreensão e gramática aplicada ao texto técnico"], ["Segurança da Informação", "Criptografia assimétrica e assinaturas digitais"], ["Redes de Computadores", "Arquitetura TCP/IP e protocolos de aplicação"]].entries()) {
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

test("Painel: proporção e primeira dobra na referência Stitch", async ({ page, context }) => {
  test.setTimeout(150000);
  const user = await fixturePrisma.user.findUniqueOrThrow({ where: { id: fixtureUserId } });
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name, email: user.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const phase = process.env.MATCH_PHASE ?? "after";
  const measurements: Record<string, unknown> = {};
  for (const width of [1440, 1920, 390]) {
    const height = width === 1920 ? 1080 : width === 390 ? 844 : 900;
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => localStorage.setItem("theme", value), theme);
      await page.goto("/dashboard"); await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready);
      measurements[`${theme}-${width}`] = await page.evaluate(() => {
        const box = (selector: string) => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.x, y: r.y, width: r.width, height: r.height, font: s.fontSize, padding: s.padding, gap: s.gap }; };
        return { main: box("main"), heading: box("main h1"), hero: box('[aria-labelledby="next-study-title"]'), title: box("#next-study-title"), metric: box('[aria-labelledby="next-study-title"] .sf-chip'), plan: box('[aria-labelledby="today-plan-title"]'), kpis: box('[aria-label="Indicadores de estudo"]'), recent: box('[aria-labelledby="recent-studies-title"]'), performance: box('[aria-labelledby="recent-performance-title"]'), sidebar: box("aside") };
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.getByRole("link", { name: "Estudar agora", exact: true })).toBeVisible();
      if (phase === "after" && width >= 1440) {
        const hero = (await page.locator('[aria-labelledby="next-study-title"]').boundingBox())!;
        expect(hero.width).toBeLessThanOrEqual(900); expect(hero.height).toBeLessThanOrEqual(310);
        const recent = (await page.locator('[aria-labelledby="recent-studies-title"]').boundingBox())!;
        expect(recent.y).toBeLessThanOrEqual(610);
        await expect(page.getByRole("heading", { name: "Atividade recente", exact: true })).toBeInViewport();
        await expect(page.getByRole("heading", { name: "Desempenho por matéria", exact: true })).toBeInViewport();
      }
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `artifacts/dashboard-match/${phase}-${theme}-${width}.png` });
    }
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(`artifacts/dashboard-match/${phase}-measurements.json`, JSON.stringify(measurements, null, 2));
  if (phase === "after") {
    const entry = await fixturePrisma.cycleEntry.findFirstOrThrow({ where: { userId: fixtureUserId }, orderBy: { orderIndex: "asc" } });
    await fixturePrisma.subject.update({ where: { id: entry.subjectId! }, data: { name: "ETL, BI, Big Data, ML, Mineração, Bancos Distribuídos e Ferramentas" } });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard"); await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByRole("link", { name: "Estudar agora", exact: true })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Atividade recente", exact: true })).toBeInViewport();
    const title = await page.locator("#next-study-title").evaluate(el => ({ font: getComputedStyle(el).fontSize, overflow: el.scrollWidth > el.clientWidth }));
    expect(title).toEqual({ font: "22px", overflow: false });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.screenshot({ path: "artifacts/dashboard-match/after-long-title-1440.png" });
  }
});
