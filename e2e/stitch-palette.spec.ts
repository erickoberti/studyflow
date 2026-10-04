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

test("paleta Stitch compartilhada nas telas, claro e escuro", async ({ page, context }) => {
  test.setTimeout(240000);
  const user = await fixturePrisma.user.findUniqueOrThrow({ where: { id: fixtureUserId } });
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name, email: user.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const routes = [["dashboard", "/dashboard"], ["estudar", "/registro"], ["ciclo", "/ciclo"], ["disciplinas", "/base"], ["historico", "/registros"], ["revisoes", "/revisao"], ["metas", "/metas"], ["planejamento", "/planejamento"], ["estatisticas", "/estatisticas"], ["simulados", "/simulados"], ["guias", "/guias"], ["configuracoes", "/configuracoes"]];
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [name, route] of routes) {
      await page.goto(route); await page.waitForLoadState("networkidle");
      const colors = await page.evaluate(() => {
        const styles = getComputedStyle(document.body);
        return { background: styles.backgroundColor, primary: styles.getPropertyValue("--primary-rgb").trim(), foreground: styles.getPropertyValue("--foreground").trim(), surface: styles.getPropertyValue("--surface").trim(), elevated: styles.getPropertyValue("--surface-elevated").trim() };
      });
      expect(colors).toEqual(theme === "light" ? { background: "rgb(252, 248, 255)", primary: "70 72 212", foreground: "#1b1b23", surface: "#ffffff", elevated: "#f5f2fe" } : { background: "rgb(12, 14, 21)", primary: "99 102 241", foreground: "#f1f5f9", surface: "#151927", elevated: "#1d2436" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `artifacts/palette-match/${name}-${theme}-1440.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard"); await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.screenshot({ path: `artifacts/palette-match/dashboard-${theme}-390.png` });
  }
});

