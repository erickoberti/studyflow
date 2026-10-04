import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolatedDatabase = process.env.E2E_INTEGRATED === "true"
  && databaseUrl?.hostname === "127.0.0.1"
  && databaseUrl?.pathname === "/studyflow_integration";

test.describe("validação integrada em banco isolado", () => {
  test.skip(!isolatedDatabase, "Exige E2E_INTEGRATED=true e a base local studyflow_integration");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const prisma = new PrismaClient();
  const password = "Integration-Test-2026!";
  const fixture: Record<string, string> = {};

  test.beforeAll(async () => {
    const suffix = Date.now().toString(36);
    const passwordHash = await bcrypt.hash(password, 10);
    for (const label of ["a", "b"]) {
      const user = await prisma.user.create({ data: { name: `Conta ${label.toUpperCase()}`, email: `integration-${label}-${suffix}@example.test`, passwordHash, settings: { create: {} } } });
      const guide = await prisma.studyGuide.create({ data: { userId: user.id, name: `Guia ${label.toUpperCase()}` } });
      await prisma.user.update({ where: { id: user.id }, data: { activeStudyGuideId: guide.id } });
      const discipline = await prisma.discipline.create({ data: { userId: user.id, studyGuideId: guide.id, name: `Disciplina ${label.toUpperCase()}`, sortOrder: 1 } });
      const subject = await prisma.subject.create({ data: { userId: user.id, studyGuideId: guide.id, disciplineId: discipline.id, name: "Assunto homônimo", weight: 2 } });
      const entry = await prisma.cycleEntry.create({ data: { userId: user.id, studyGuideId: guide.id, disciplineId: discipline.id, subjectId: subject.id, orderIndex: 1 } });
      Object.assign(fixture, { [`user${label}`]: user.id, [`email${label}`]: user.email, [`guide${label}`]: guide.id, [`discipline${label}`]: discipline.id, [`subject${label}`]: subject.id, [`entry${label}`]: entry.id });
    }
    const second = await prisma.discipline.create({ data: { userId: fixture.usera, studyGuideId: fixture.guidea, name: "Outra disciplina", sortOrder: 2 } });
    const homonym = await prisma.subject.create({ data: { userId: fixture.usera, studyGuideId: fixture.guidea, disciplineId: second.id, name: "Assunto homônimo", weight: 3 } });
    Object.assign(fixture, { otherDiscipline: second.id, homonym: homonym.id });
  });

  test.afterAll(async () => { await prisma.$disconnect(); });

  async function login(page: import("@playwright/test").Page, label: "a" | "b", valid = true) {
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");
    const passwordInput = page.getByLabel("Senha", { exact: true });
    await expect.poll(async () => {
      if (await passwordInput.getAttribute("type") === "text") return true;
      await page.getByRole("button", { name: "Mostrar ou ocultar senha" }).click();
      return await passwordInput.getAttribute("type") === "text";
    }).toBe(true);
    await page.getByRole("button", { name: "Mostrar ou ocultar senha" }).click();
    await page.getByLabel("E-mail").fill(fixture[`email${label}`]);
    await passwordInput.fill(valid ? password : "wrong-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    if (valid) {
      await expect.poll(async () => {
        try { return await page.evaluate(async () => (await (await fetch("/api/auth/session")).json()).user?.id); }
        catch { return null; }
      }).toBe(fixture[`user${label}`]);
      await expect(page).toHaveURL(/\/dashboard$/);
    }
    else await expect(page.locator("#login-error")).toContainText("Credenciais invalidas");
  }

  test("login, rejeição, sessão, expiração, logout e proxy", async ({ page, context, browser }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
    await login(page, "a", false);
    expect((await page.request.get("/api/auth/session")).status()).toBe(200);
    await login(page, "a");
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.user.id).toBe(fixture.usera);
    await expect(page.getByRole("heading", { name: "Painel de Estudos" })).toBeVisible();

    const expired = await browser.newContext();
    try {
      const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: fixture.usera, sub: fixture.usera }, maxAge: -60 });
      await expired.addCookies([{ name: "next-auth.session-token", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
      const expiredPage = await expired.newPage();
      await expiredPage.goto("/dashboard");
      await expect(expiredPage).toHaveURL(/\/auth\/login/);
    } finally { await expired.close(); }

    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Sair", exact: true }).first().click();
    await expect.poll(async () => (await context.cookies()).some((cookie) => cookie.name.endsWith("session-token")), { timeout: 20_000 }).toBe(false);
    await expect.poll(async () => {
      try { return await page.evaluate(async () => Boolean((await (await fetch("/api/auth/session")).json()).user)); }
      catch { return true; }
    }, { timeout: 20_000 }).toBe(false);
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
    await context.clearCookies();
  });

  test("histórico, progresso, homônimos e acesso entre contas", async ({ page, browser }) => {
    await login(page, "a");
    const created = await page.request.post("/api/study-sessions", { data: { studyGuideId: fixture.guidea, disciplineId: fixture.disciplinea, subjectId: fixture.subjecta, date: "2026-10-01", time: "10:30", correct: 8, wrong: 2, estimatedMinutes: 30, difficulty: "Média" } });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id as string;
    const firstProgress = await prisma.subjectProgress.findFirst({ where: { userId: fixture.usera, subjectId: fixture.subjecta } });
    expect(firstProgress?.totalQuestions).toBe(10);
    expect(await prisma.subjectProgress.findFirst({ where: { subjectId: fixture.homonym } })).toBeNull();

    const update = { id, date: "2026-10-02", cycleEntryId: null, subjectId: fixture.subjecta, questions: 12, correct: 9, wrong: 3, estimatedMinutes: 35, notes: "Atualizado" };
    expect((await page.request.put("/api/study-sessions", { data: update })).status()).toBe(200);
    expect((await prisma.subjectProgress.findFirst({ where: { subjectId: fixture.subjecta } }))?.totalQuestions).toBe(12);
    expect((await prisma.studySession.findUniqueOrThrow({ where: { id } })).date.toISOString().startsWith("2026-10-02")).toBe(true);

    const contextB = await browser.newContext();
    try {
      const pageB = await contextB.newPage();
      await login(pageB, "b");
      expect((await (await pageB.request.get("/api/study-sessions")).json()).some((row: { id: string }) => row.id === id)).toBe(false);
      expect((await pageB.request.put("/api/study-sessions", { data: update })).status()).toBe(404);
      expect((await pageB.request.delete("/api/study-sessions", { data: { id } })).status()).toBe(404);
      const foreignCreate = await pageB.request.post("/api/study-sessions", { data: { studyGuideId: fixture.guideb, disciplineId: fixture.disciplineb, subjectId: fixture.subjecta, date: "2026-10-01", time: "10:30", correct: 1, wrong: 0, estimatedMinutes: 5, difficulty: "Média" } });
      expect(foreignCreate.status()).toBe(400);
    } finally { await contextB.close(); }

    const concurrent = await Promise.all([
      page.request.put("/api/study-sessions", { data: { ...update, correct: 10, wrong: 2 } }),
      page.request.put("/api/study-sessions", { data: { ...update, correct: 7, wrong: 5 } }),
    ]);
    expect(concurrent.map((response) => response.status())).toEqual([200, 200]);
    const stored = await prisma.studySession.findUniqueOrThrow({ where: { id } });
    const progress = await prisma.subjectProgress.findFirstOrThrow({ where: { subjectId: fixture.subjecta } });
    expect(progress.totalQuestions).toBe(stored.questions);
    expect(progress.correct).toBe(stored.correct);
    expect((await page.request.delete("/api/study-sessions", { data: { id } })).status()).toBe(200);
    expect((await prisma.subjectProgress.findFirst({ where: { subjectId: fixture.subjecta } }))?.totalQuestions ?? 0).toBe(0);
    expect(await prisma.subject.findUnique({ where: { id: fixture.homonym } })).not.toBeNull();
  });

  test("sincronização estrutural aceita dono e rejeita outra conta", async ({ page, browser }) => {
    await login(page, "a");
    const operation = (id: string, subjectId: string, disciplineId: string) => ({ id, entity: "subject", action: "update", payload: { id: subjectId, disciplineId, name: "Assunto homônimo editado", weight: 4, active: true, orderIndex: 1 }, createdAt: new Date().toISOString() });
    const own = await page.request.post("/api/offline/sync", { data: { operations: [operation("own-update", fixture.subjecta, fixture.disciplinea)] } });
    expect((await own.json()).results[0].status).toBe("completed");
    const mixed = await page.request.post("/api/offline/sync", { data: { operations: [operation("batch-own", fixture.subjecta, fixture.disciplinea), operation("batch-foreign", fixture.subjectb, fixture.disciplineb)] } });
    expect((await mixed.json()).results.map((result: { status: string }) => result.status)).toEqual(["completed", "rejected"]);
    const contextB = await browser.newContext();
    try {
      const pageB = await contextB.newPage();
      await login(pageB, "b");
      const foreign = await pageB.request.post("/api/offline/sync", { data: { operations: [operation("foreign-update", fixture.subjecta, fixture.disciplineb)] } });
      expect((await foreign.json()).results[0].status).toBe("rejected");
      expect((await prisma.subject.findUniqueOrThrow({ where: { id: fixture.subjecta } })).name).toBe("Assunto homônimo editado");
    } finally { await contextB.close(); }
  });

  test("backup, restauração, validação e isolamento", async ({ page, browser }) => {
    await login(page, "a");
    const backupResponse = await page.request.get("/api/backup");
    expect(backupResponse.status()).toBe(200);
    const backup = await backupResponse.json();
    const originalCount = backup.data.Subject.length;
    await prisma.subject.create({ data: { userId: fixture.usera, studyGuideId: fixture.guidea, disciplineId: fixture.disciplinea, name: "Temporário" } });
    expect((await prisma.subject.count({ where: { userId: fixture.usera } }))).toBe(originalCount + 1);
    expect((await page.request.post("/api/backup", { data: { ...backup, mode: "replace", version: 999 } })).status()).toBe(400);
    expect((await page.request.post("/api/backup", { data: { ...backup, mode: "replace", accountId: fixture.userb } })).status()).toBe(400);
    expect((await page.request.post("/api/backup", { data: { ...backup, mode: "replace" } })).status()).toBe(200);
    expect((await prisma.subject.count({ where: { userId: fixture.usera } }))).toBe(originalCount);
    expect((await prisma.subject.count({ where: { userId: fixture.userb } }))).toBe(1);
    const contextB = await browser.newContext();
    try {
      const pageB = await contextB.newPage(); await login(pageB, "b");
      expect((await pageB.request.post("/api/backup", { data: { ...backup, mode: "replace" } })).status()).toBe(400);
    } finally { await contextB.close(); }
  });

  test("importação diária persiste, rejeita inválidos e não duplica reenvio", async ({ page }) => {
    await login(page, "a");
    const upload = async (csv: string) => page.request.post("/api/import/daily", { multipart: { file: { name: "daily.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } } });
    const header = "Data;Disciplina;Assunto;Peso;Questões;Acertos;Erros\n";
    const row = "01/10/2026;Importada;Tópico 1;2;10;8;2\n";
    const first = await upload(header + row);
    expect(first.status()).toBe(200);
    expect((await first.json()).importedRows).toBe(1);
    const repeated = await upload(header + row);
    expect(repeated.status()).toBe(200);
    expect((await repeated.json()).skippedRows).toBe(1);
    expect((await upload(header + "31/02/2026;Importada;Inválido;2;10;8;2\n")).status()).toBe(400);
    const additional = await upload(header + "02/10/2026;Importada;Tópico 1;2;5;4;1\n");
    expect((await additional.json()).importedRows).toBe(1);
    const conflict = await upload(header + "01/10/2026;Importada;Tópico 1;2;10;7;3\n");
    expect(conflict.status()).toBe(207);
    expect((await conflict.json()).conflictRows).toBe(1);
    const subject = await prisma.subject.findFirstOrThrow({ where: { userId: fixture.usera, name: "Tópico 1" } });
    expect(await prisma.studySession.count({ where: { userId: fixture.usera, subjectId: subject.id } })).toBe(2);
    expect((await prisma.subjectProgress.findUniqueOrThrow({ where: { subjectId: subject.id } })).totalQuestions).toBe(15);
  });

  test("operação offline avulsa é idempotente e vinculada à conta", async ({ page, browser }) => {
    await login(page, "a");
    const localSessionId = `local-${Date.now()}`;
    const operation = {
      operationId: `operation-${localSessionId}`, userId: fixture.usera, studyGuideId: fixture.guidea, type: "CREATE_STANDALONE_SESSION",
      payload: { localSessionId, serverSessionId: null, serverVersion: null, mode: "AVULSO", scope: "SUBJECT", disciplineId: fixture.disciplinea, subjectId: fixture.subjecta, cycleEntryId: null, status: "FINISHED", startedAt: "2026-10-02T12:00:00.000Z", accumulatedSeconds: 1200, questions: 5, correct: 4, wrong: 1, activityType: "QUESTIONS", difficulty: "Média", notes: "Offline", date: "2026-10-02T12:00:00.000Z" },
    };
    const first = await page.request.post("/api/offline/session-operations", { data: operation });
    expect(first.status()).toBe(200);
    const sessionId = (await first.json()).serverSessionId as string;
    expect((await prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } })).subjectId).toBe(fixture.subjecta);
    const replay = await page.request.post("/api/offline/session-operations", { data: operation });
    expect((await replay.json()).idempotentReplay).toBe(true);
    expect(await prisma.studySession.count({ where: { id: sessionId } })).toBe(1);
    const contextB = await browser.newContext();
    try {
      const pageB = await contextB.newPage(); await login(pageB, "b");
      expect((await pageB.request.post("/api/offline/session-operations", { data: operation })).status()).toBe(403);
    } finally { await contextB.close(); }
    const guideWithoutCycle = await prisma.studyGuide.create({ data: { userId: fixture.usera, name: "Guia sem ciclo" } });
    const discipline = await prisma.discipline.create({ data: { userId: fixture.usera, studyGuideId: guideWithoutCycle.id, name: "Disciplina avulsa" } });
    const subject = await prisma.subject.create({ data: { userId: fixture.usera, studyGuideId: guideWithoutCycle.id, disciplineId: discipline.id, name: "Assunto avulso" } });
    const noCycle = await page.request.post("/api/offline/session-operations", { data: { ...operation, operationId: `no-cycle-${localSessionId}`, studyGuideId: guideWithoutCycle.id, payload: { ...operation.payload, localSessionId: `no-cycle-${localSessionId}`, disciplineId: discipline.id, subjectId: subject.id } } });
    expect(noCycle.status()).toBe(200);
    expect((await prisma.studySession.findUniqueOrThrow({ where: { id: (await noCycle.json()).serverSessionId } })).cycleEntryId).toBeNull();
  });

  test("operações offline do ciclo exigem dependência e preservam data e assunto", async ({ page }) => {
    await login(page, "a");
    const suffix = Date.now().toString(36);
    const payload = { localSessionId: `cycle-${suffix}`, serverSessionId: null as string | null, serverVersion: null as number | null, mode: "CYCLE", scope: "SUBJECT", disciplineId: fixture.disciplinea, subjectId: fixture.subjecta, cycleEntryId: fixture.entrya, status: "ACTIVE", startedAt: "2026-10-02T12:00:00.000Z", accumulatedSeconds: 1200, questions: 6, correct: 5, wrong: 1, activityType: "QUESTIONS", advanceCycle: true, difficulty: "Média", notes: "Ciclo offline", date: "2026-10-02T12:00:00.000Z" };
    const finishBeforeStart = await page.request.post("/api/offline/session-operations", { data: { operationId: `finish-early-${suffix}`, userId: fixture.usera, studyGuideId: fixture.guidea, type: "FINISH_SESSION", payload } });
    expect(finishBeforeStart.status()).toBe(409);
    const startOperation = { operationId: `start-${suffix}`, userId: fixture.usera, studyGuideId: fixture.guidea, type: "START_SESSION", payload };
    const startResponse = await page.request.post("/api/offline/session-operations", { data: startOperation });
    expect(startResponse.status()).toBe(200);
    const started = (await startResponse.json()).session as { id: string; version: number; cycle: { entryId: string } };
    expect(started.cycle.entryId).toBe(fixture.entrya);
    const finishOperation = { operationId: `finish-${suffix}`, userId: fixture.usera, studyGuideId: fixture.guidea, type: "FINISH_SESSION", payload: { ...payload, serverSessionId: started.id, serverVersion: started.version } };
    const finishResponse = await page.request.post("/api/offline/session-operations", { data: finishOperation });
    expect(finishResponse.status()).toBe(200);
    const sessionId = (await finishResponse.json()).sessionId as string;
    const session = await prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.subjectId).toBe(fixture.subjecta);
    expect(session.cycleEntryId).toBe(fixture.entrya);
    expect(session.date.toISOString()).toBe(payload.date);
    expect((await page.request.post("/api/offline/session-operations", { data: finishOperation })).status()).toBe(200);
    expect(await prisma.studySession.count({ where: { activeStudySessionId: started.id } })).toBe(1);
  });

  test("manutenção do ciclo preserva histórico legado e recupera o assunto", async ({ page }) => {
    await login(page, "a");
    const entry = await prisma.cycleEntry.create({ data: { userId: fixture.usera, studyGuideId: fixture.guidea, disciplineId: fixture.disciplinea, subjectId: fixture.subjecta, orderIndex: 2 } });
    const history = await prisma.studySession.create({ data: { userId: fixture.usera, studyGuideId: fixture.guidea, cycleEntryId: entry.id, subjectId: null, scope: "CYCLE", cyclePosition: 2, date: new Date("2026-10-01T12:00:00.000Z"), questions: 10, correct: 8, wrong: 2, percentage: 80, estimatedMinutes: 30 } });
    await page.goto("/ciclo");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(`form:has(input[name="entryId"][value="${entry.id}"]) button[title="Excluir ciclo"]`).click();
    await expect.poll(async () => prisma.cycleEntry.count({ where: { id: entry.id } })).toBe(0);
    const preserved = await prisma.studySession.findUniqueOrThrow({ where: { id: history.id } });
    expect(preserved.cycleEntryId).toBeNull();
    expect(preserved.subjectId).toBe(fixture.subjecta);
    expect(preserved.questions).toBe(10);
  });

  test("troca de conta preserva snapshots separados e não revela dados da outra", async ({ page }) => {
    const currentSnapshot = () => page.evaluate(() => {
      const access = JSON.parse(localStorage.getItem("studyflow-offline-access") ?? "null");
      if (!access?.userId) return null;
      return JSON.parse(localStorage.getItem(`studyflow-offline-snapshot:${encodeURIComponent(access.userId)}`) ?? "null");
    });
    const logout = async () => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Sair", exact: true }).first().click();
      await expect(page).toHaveURL(/\/auth\/login/);
    };
    await login(page, "a");
    await expect.poll(async () => (await currentSnapshot())?.user?.id).toBe(fixture.usera);
    await page.goto("/offline/dashboard");
    await expect(page.getByRole("heading", { name: "Guia A" })).toBeVisible();
    await logout();
    await login(page, "b");
    await expect.poll(async () => (await currentSnapshot())?.user?.id).toBe(fixture.userb);
    const snapshotB = await currentSnapshot();
    expect(JSON.stringify(snapshotB)).not.toContain(fixture.guidea);
    expect(JSON.stringify(snapshotB)).not.toContain(fixture.subjecta);
    await page.goto("/offline/dashboard");
    await expect(page.getByRole("heading", { name: "Guia B" })).toBeVisible();
    await expect(page.getByText("Guia A")).toHaveCount(0);
    await logout();
    await login(page, "a");
    await expect.poll(async () => (await currentSnapshot())?.user?.id).toBe(fixture.usera);
    await page.goto("/offline/dashboard");
    await expect(page.getByRole("heading", { name: "Guia A" })).toBeVisible();
  });

  test("PWA real mantém criação e edição offline e sincroniza sem duplicar", async ({ page, context }) => {
    test.skip(process.env.E2E_PRODUCTION !== "true", "Exige o service worker do build de produção");
    await login(page, "a");
    await expect(page.getByRole("heading", { name: "Painel de Estudos" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const seedResponse = await page.evaluate(async (payload) => {
      const response = await fetch("/api/study-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json() };
    }, { studyGuideId: fixture.guidea, disciplineId: fixture.disciplinea, subjectId: fixture.subjecta, date: "2026-10-01", time: "10:30", correct: 8, wrong: 2, estimatedMinutes: 30, difficulty: "Média", notes: "editar offline" });
    expect(seedResponse.status).toBe(201);
    const seedId = seedResponse.body.id as string;
    await page.goto("/dashboard");
    await expect.poll(async () => page.evaluate((id) => {
      const access = JSON.parse(localStorage.getItem("studyflow-offline-access") ?? "null");
      const snapshot = access?.userId ? JSON.parse(localStorage.getItem(`studyflow-offline-snapshot:${encodeURIComponent(access.userId)}`) ?? "null") : null;
      return snapshot?.sessions?.some((session: { serverId: string }) => session.serverId === id) ?? false;
    }, seedId)).toBe(true);
    await page.goto("/offline/registro");
    await expect(page.getByRole("heading", { name: "Salvar sessão local" })).toBeVisible();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.goto("/offline/registros");
    await expect(page.getByRole("heading", { name: "Sessões locais" })).toBeVisible();
    await expect.poll(async () => page.evaluate(async () => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname === "/offline/registros" && (await cache.match(request))?.headers.get("content-type")?.includes("text/html")) return true;
        }
      }
      return false;
    })).toBe(true);
    await page.goto("/offline/registro");
    await expect.poll(async () => page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return false;
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname === "/offline/registro" && (await cache.match(request))?.headers.get("content-type")?.includes("text/html")) return true;
        }
      }
      return false;
    })).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Salvar sessão local" })).toBeVisible();
    await page.getByRole("button", { name: "Por matéria" }).click();
    await page.getByLabel("Disciplina", { exact: true }).selectOption(fixture.disciplinea);
    await page.getByLabel("Assunto", { exact: true }).selectOption(fixture.subjecta);
    await page.getByRole("button", { name: "Videoaula", exact: true }).click();
    const note = `criada offline ${Date.now()}`;
    await page.getByLabel("Observação").fill(note);
    await page.getByRole("button", { name: "Salvar videoaula localmente" }).click();
    await expect(page.getByText(/pendente\(s\)/)).not.toContainText("0 pendente(s)");

    await page.getByRole("link", { name: "Sessões" }).click();
    await expect(page.getByRole("heading", { name: "Sessões locais" })).toBeVisible();
    await page.getByRole("button", { name: "Editar" }).first().click();
    await page.getByLabel("Questões", { exact: true }).fill("12");
    await page.getByLabel("Acertos", { exact: true }).fill("9");
    await page.getByLabel("Notas", { exact: true }).fill("editada sem rede");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    const cacheState = await page.evaluate(async () => {
      let cachedHtml = false;
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname === "/offline/registros" && (await cache.match(request))?.headers.get("content-type")?.includes("text/html")) cachedHtml = true;
        }
      }
      return { path: location.pathname, controlled: Boolean(navigator.serviceWorker.controller), cachedHtml };
    });
    expect(cacheState).toEqual({ path: "/offline/registros", controlled: true, cachedHtml: true });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sessões locais" })).toBeVisible();
    await expect(page.getByText(/pendente\(s\)/)).not.toContainText("0 pendente(s)");

    await context.setOffline(false);
    await page.getByRole("button", { name: "Sincronizar", exact: true }).click();
    await expect.poll(async () => (await prisma.studySession.findUnique({ where: { id: seedId } }))?.notes).toBe("editada sem rede");
    await expect.poll(async () => prisma.studySession.count({ where: { userId: fixture.usera, notes: { contains: note } } })).toBe(1);
    await expect(page.getByText("0 pendente(s)")).toBeVisible();
    await page.getByRole("button", { name: "Sincronizar", exact: true }).click();
    expect(await prisma.studySession.count({ where: { userId: fixture.usera, notes: { contains: note } } })).toBe(1);
  });
});
