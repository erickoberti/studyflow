import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/prisma";
import { saveCycleProgram } from "../src/lib/programmed-cycle-service";
import { type ProgramRow } from "../src/lib/programmed-cycle";
import { validateBackup } from "../src/lib/backup";

test.use({ serviceWorkers: "block" });

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(process.env.PROGRAM_CYCLE_INTEGRATION !== "true" || url?.hostname !== "127.0.0.1" || url.pathname !== "/studyflow_program_test", "Somente PostgreSQL local fictício.");

test("guia de 19 posições mostra a volta correta e preserva tempos ao editar", async ({ page, context }) => {
  const user = await prisma.user.create({ data: { name: "Aluno fictício", email: `ui-nineteen-${Date.now()}@example.test`, passwordHash: "not-a-login" } });
  const guide = await prisma.studyGuide.create({ data: { userId: user.id, name: "TI Geral fictício | 19 posições" } });
  try {
    const rows: ProgramRow[] = Array.from({ length: 19 }, (_, index) => ({ position: index + 1, matter: `Matéria ${index % 3}`, questionGoal: 6, topics: Array.from({ length: 4 }, (_, round) => ({ name: `Assunto ${index + 1} volta ${round + 1}`, tecDiscipline: "", tecTopic: "", tecUrl: "", tecStatus: "SUGGESTED", plannedMinutes: index === 0 ? 40 : 10, minimumQuestions: 2 })) }));
    await saveCycleProgram(user.id, guide.id, { version: 0, rows, legacyCredits: [] });
    await prisma.user.update({ where: { id: user.id }, data: { activeStudyGuideId: guide.id } });
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user.id, sub: user.id, name: user.name }, maxAge: 3600 });
    await context.addCookies(["next-auth.session-token", "__Secure-next-auth.session-token"].map(name => ({ name, value: token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: name.startsWith("__Secure"), sameSite: "Lax" as const })));
    await page.goto("/ciclo");
    await expect(page.getByRole("navigation", { name: "Mapa do ciclo" }).getByRole("link")).toHaveCount(19);
    await expect(page.getByText("Agora · posição 1/19 · volta 1/4", { exact: true })).toBeVisible();
    await expect(page.getByText("~40 minutos", { exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByText("40 minutos", { exact: true })).toBeVisible();
    await page.goto("/ciclo/configuracao");
    await expect(page.locator("tbody tr")).toHaveCount(19);
    await expect(page.locator("textarea")).toHaveCount(76);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width < 768) await page.getByLabel("Volta exibida", { exact: true }).selectOption("3");
      await expect(page.getByRole("textbox", { name: "Assunto da posição 19, volta 4", exact: true })).toHaveValue("Assunto 19 volta 4");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `artifacts/ti-geral-matrix-${width}.png`, fullPage: true });
    }
    await page.getByLabel("Volta exibida", { exact: true }).selectOption("0");
    await page.getByRole("textbox", { name: "Assunto da posição 1, volta 1", exact: true }).fill("Assunto revisado");
    await page.getByRole("button", { name: "Salvar programação", exact: true }).click();
    await expect(page).toHaveURL(/\/ciclo$/);
    await expect(page.getByText("~40 minutos", { exact: true })).toBeVisible();
    const item = await prisma.cycleProgramItem.findFirstOrThrow({ where: { program: { studyGuideId: guide.id }, roundNumber: 1, entry: { orderIndex: 1 } } });
    expect(item.plannedMinutes).toBe(40); expect(item.minimumQuestions).toBe(2);
    const cookie = `${process.env.E2E_PRODUCTION === "true" ? "__Secure-next-auth.session-token" : "next-auth.session-token"}=${token}`;
    const backup = await (await context.request.get("/api/backup", { headers: { Cookie: cookie } })).json();
    expect(validateBackup(backup, user.id).data.CycleProgramItem.length).toBe(76);
    await page.screenshot({ path: "artifacts/ti-geral-cycle-mobile.png", fullPage: true });
  } finally {
    await prisma.cycleProgram.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
