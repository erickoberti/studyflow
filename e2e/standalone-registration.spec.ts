import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

async function authenticate(context: BrowserContext) {
  test.skip(!process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET não configurado");
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { activeStudyGuideId: { not: null } }, select: { id: true, name: true, email: true } });
  await prisma.$disconnect();
  test.skip(!user, "Nenhum usuário com guia ativo disponível para teste somente leitura");
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: user!.id, sub: user!.id, name: user!.name, email: user!.email }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

async function selectContent(page: Page) {
  const guide = page.getByLabel("Guia", { exact: true });
  const discipline = page.getByLabel("Disciplina", { exact: true });
  const subject = page.getByLabel("Assunto", { exact: true });
  const guideId = await guide.inputValue();
  expect(guideId).not.toBe("");
  const disciplineOptions = await discipline.locator("option:not([value=''])").evaluateAll((items) => items.map((item) => ({ value: (item as HTMLOptionElement).value, label: item.textContent ?? "" })));
  test.skip(!disciplineOptions.length, "Guia de auditoria não possui disciplinas ativas");
  await discipline.selectOption(disciplineOptions[0].value);
  await expect(subject).toBeEnabled();
  const subjectOptions = await subject.locator("option:not([value=''])").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  test.skip(!subjectOptions.length, "Disciplina de auditoria não possui assuntos ativos");
  await subject.selectOption(subjectOptions[0]);
  return { discipline, subject, disciplineOptions, selectedSubjectId: subjectOptions[0] };
}

test("troca de disciplina filtra assuntos e limpa a escolha anterior", async ({ page, context }) => {
  await authenticate(context);
  await page.goto("/registro?novo=1");
  await expect(page.getByRole("heading", { name: "Registrar estudo realizado" })).toBeVisible();
  await expect(page.getByLabel("Assunto", { exact: true })).toBeDisabled();
  const discipline = page.getByLabel("Disciplina", { exact: true });
  const disciplineOptions = await discipline.locator("option:not([value=''])").evaluateAll((items) => items.map((item) => ({ value: (item as HTMLOptionElement).value, label: item.textContent ?? "" })));
  if (disciplineOptions.length > 8) {
    const first = disciplineOptions[0];
    const queryWithoutAccents = first.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    await page.getByPlaceholder("Pesquisar disciplina").fill(queryWithoutAccents);
    const result = page.locator("#standalone-discipline-results").getByRole("option", { name: first.label, exact: true });
    await expect(result).toBeVisible();
    await result.click();
    await expect(discipline).toHaveValue(first.value);
    await expect(page.getByLabel("Assunto", { exact: true })).toBeEnabled();
  }
  const selected = await selectContent(page);
  if (selected.disciplineOptions.length > 1) {
    await selected.discipline.selectOption(selected.disciplineOptions[1].value);
    await expect(selected.subject).toHaveValue("");
    await expect(selected.subject).toBeEnabled();
    const options = await selected.subject.locator("option:not([value=''])").count();
    expect(options).toBeGreaterThan(0);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("falha preserva o formulário e sucesso limpa todos os resultados", async ({ page, context }) => {
  await authenticate(context);
  let attempts = 0;
  let savedPayload: Record<string, unknown> | null = null;
  await page.route("**/api/study-sessions", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts += 1;
    savedPayload = route.request().postDataJSON();
    if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Falha temporária simulada" }) });
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "session-e2e" }) });
  });
  await page.goto("/registro?novo=1");
  const selected = await selectContent(page);
  await page.getByLabel("Data do estudo").fill("2026-07-20");
  await page.getByLabel("Horário do estudo").fill("10:30");
  await page.getByLabel("Duração em minutos").fill("20");
  await page.getByLabel("Acertos").fill("8");
  await page.getByLabel("Erros").fill("2");
  await page.getByRole("button", { name: "Difícil" }).click();
  await page.getByLabel("Observação").fill("Revisar o assunto");
  await page.getByRole("button", { name: "Salvar estudo avulso" }).click();
  await expect(page.locator("#main-content").getByText("Falha temporária simulada", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Acertos")).toHaveValue("8");
  await expect(page.getByLabel("Erros")).toHaveValue("2");
  await expect(page.getByLabel("Assunto", { exact: true })).toHaveValue(selected.selectedSubjectId);

  await page.getByRole("button", { name: "Salvar estudo avulso" }).click();
  await expect(page.locator("#main-content").getByText("Estudo avulso salvo. O ciclo permaneceu na mesma posição.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Acertos")).toHaveValue("");
  await expect(page.getByLabel("Erros")).toHaveValue("");
  await expect(page.getByTestId("standalone-total")).toHaveText("0");
  await expect(page.getByTestId("standalone-percentage")).toHaveText("—");
  await expect(page.getByLabel("Observação")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Média" })).toHaveAttribute("aria-pressed", "true");
  expect(savedPayload).toMatchObject({ date: "2026-07-20", time: "10:30", estimatedMinutes: 20, correct: 8, wrong: 2, difficulty: "Difícil", subjectId: selected.selectedSubjectId });
});
