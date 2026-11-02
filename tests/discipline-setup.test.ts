import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { buildStudyGuideCycle, createStudyDiscipline, setStudyDisciplineActive } from "../src/lib/discipline-setup";
import { prisma } from "../src/lib/prisma";
import { generalStudySubjectId, initialCycleEntryId } from "../src/lib/study-defaults";
import { createOfflineDiscipline, getOfflineSnapshot, setOfflineAccess, setOfflineSnapshot, updateOfflineDiscipline } from "../src/lib/offline/store";
import { getOfflineNextSuggestion } from "../src/lib/offline/analytics";
import type { OfflineSnapshot } from "../src/lib/offline/types";

type Discipline = { id: string; userId: string; studyGuideId: string; name: string; active: boolean; sortOrder: number | null };
type Subject = { id: string; userId: string; studyGuideId: string; disciplineId: string; name: string; active: boolean; sortOrder: number };
type Entry = { id: string; userId: string; studyGuideId: string; disciplineId: string | null; subjectId: string; active: boolean; orderIndex: number };
const discipline = (id: string, extra: Partial<Discipline> = {}): Discipline => ({ id, userId: "user", studyGuideId: "guide", name: id, active: true, sortOrder: null, ...extra });
const subject = (id: string, disciplineId: string, extra: Partial<Subject> = {}): Subject => ({ id, userId: "user", studyGuideId: "guide", disciplineId, name: id, active: true, sortOrder: 0, ...extra });
const entry = (id: string, disciplineId: string | null, subjectId: string, extra: Partial<Entry> = {}): Entry => ({ id, userId: "user", studyGuideId: "guide", disciplineId, subjectId, active: true, orderIndex: 1, ...extra });

function database(t: TestContext, initial: { disciplines?: Discipline[]; subjects?: Subject[]; entries?: Entry[]; failEntry?: boolean } = {}) {
  let disciplines = structuredClone(initial.disciplines ?? []);
  let subjects = structuredClone(initial.subjects ?? []);
  let entries = structuredClone(initial.entries ?? []);
  let locked = false;
  const scoped = <T extends { userId: string; studyGuideId: string }>(row: T, where: { userId: string; studyGuideId: string }) => row.userId === where.userId && row.studyGuideId === where.studyGuideId;
  const tx = {
    $queryRaw: async (query: { sql: string; values: string[] }) => {
      assert.match(query.sql, /FOR UPDATE/);
      locked = true;
      return query.values[0] === "guide" && query.values[1] === "user" ? [{ id: "guide" }] : [];
    },
    discipline: {
      findUnique: async ({ where }: { where: { id: string } }) => disciplines.find((d) => d.id === where.id) ?? null,
      findFirst: async ({ where }: { where: Discipline }) => disciplines.find((d) => scoped(d, where) && d.id === where.id && (where.active === undefined || d.active === where.active)) ?? null,
      findMany: async ({ where }: { where: Discipline }) => disciplines.filter((d) => scoped(d, where) && d.active).sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.name.localeCompare(b.name)),
      create: async ({ data }: { data: Discipline }) => { assert.ok(locked); disciplines.push(data); return data; },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Discipline> }) => {
        assert.ok(locked);
        const existing = disciplines.find((d) => d.id === where.id);
        if (!existing) throw new Error("Disciplina não encontrada");
        Object.assign(existing, data);
        return existing;
      },
      upsert: async ({ create, update }: { create: Discipline; update: Partial<Discipline> }) => {
        assert.ok(locked);
        const existing = disciplines.find((d) => scoped(d, create) && d.name === create.name);
        if (existing) { Object.assign(existing, update); return existing; }
        const created = { ...create, id: `discipline-${disciplines.length + 1}` };
        disciplines.push(created);
        return created;
      },
    },
    subject: {
      findFirst: async ({ where }: { where: Subject }) => subjects.filter((s) => scoped(s, where) && s.disciplineId === where.disciplineId).sort((a, b) => Number(b.active) - Number(a.active))[0] ?? null,
      create: async ({ data }: { data: Subject }) => { assert.ok(locked); const created = { ...data, sortOrder: data.sortOrder ?? 0 }; subjects.push(created); return created; },
    },
    cycleEntry: {
      count: async ({ where }: { where: Entry }) => entries.filter((e) => scoped(e, where)).length,
      findFirst: async ({ where }: { where: Entry & { OR?: { disciplineId: string }[] } }) => {
        const scopedEntries = entries.filter((e) => scoped(e, where));
        if (!where.OR) return [...scopedEntries].sort((a, b) => b.orderIndex - a.orderIndex)[0] ?? null;
        const disciplineId = where.OR[0].disciplineId;
        return scopedEntries.find((e) => e.disciplineId === disciplineId || (e.disciplineId === null && subjects.some((s) => s.id === e.subjectId && s.disciplineId === disciplineId))) ?? null;
      },
      create: async ({ data }: { data: Entry }) => {
        assert.ok(locked);
        if (initial.failEntry) throw new Error("Falha ao criar posição");
        assert.ok(!entries.some((e) => scoped(e, data) && e.orderIndex === data.orderIndex));
        entries.push(data); return data;
      },
    },
  };
  const original = prisma.$transaction;
  prisma.$transaction = (async (callback: (client: unknown) => Promise<unknown>) => {
    const before = structuredClone({ disciplines, subjects, entries });
    locked = false;
    try { return await callback(tx); }
    catch (error) { ({ disciplines, subjects, entries } = before); throw error; }
  }) as typeof prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  return { get disciplines() { return disciplines; }, get subjects() { return subjects; }, get entries() { return entries; } };
}

test("cadastrar matérias já cria Estudo geral e posições consecutivas; repetir não duplica", async (t) => {
  const db = database(t);
  const first = await createStudyDiscipline("user", "guide", { name: "Português", sortOrder: null });
  await createStudyDiscipline("user", "guide", { name: "Ética", sortOrder: null });
  await createStudyDiscipline("user", "guide", { name: "Português", sortOrder: null });
  assert.equal(db.disciplines.length, 2);
  assert.equal(db.subjects.length, 2);
  assert.equal(db.subjects[0].name, "Estudo geral");
  assert.equal(db.subjects[0].id, generalStudySubjectId(first.id));
  assert.equal(db.entries[0].id, initialCycleEntryId(first.id));
  assert.equal(db.entries[0].disciplineId, first.id);
  assert.deepEqual(db.entries.map((e) => e.orderIndex), [1, 2]);
});

test("matérias existentes preservam assuntos detalhados e posições legadas pausadas", async (t) => {
  const existing = entry("legacy", null, "topic", { active: false, orderIndex: 7 });
  const db = database(t, { disciplines: [discipline("law")], subjects: [subject("topic", "law")], entries: [existing] });
  await createStudyDiscipline("user", "guide", { name: "law", sortOrder: null });
  assert.equal(db.subjects.length, 1);
  assert.deepEqual(db.entries, [existing]);
});

test("recuperação monta apenas matérias ativas do guia, reutiliza assuntos e é idempotente", async (t) => {
  const db = database(t, {
    disciplines: [discipline("a", { sortOrder: 2 }), discipline("b", { sortOrder: 1 }), discipline("paused", { active: false }), discipline("other", { studyGuideId: "other" }), discipline("foreign", { userId: "foreign" })],
    subjects: [subject("detailed-topic", "a")],
  });
  assert.deepEqual(await buildStudyGuideCycle("user", "guide"), { subjects: 1, entries: 2 });
  assert.deepEqual(db.entries.map((e) => e.disciplineId), ["b", "a"]);
  assert.equal(db.entries[1].subjectId, "detailed-topic");
  assert.equal(db.subjects.length, 2);
  assert.deepEqual(await buildStudyGuideCycle("user", "guide"), { subjects: 0, entries: 0 });
  assert.equal(db.entries.length, 2);
});

test("recuperação preserva ciclo existente e não reativa assuntos pausados", async (t) => {
  const existing = entry("existing", "a", "topic", { orderIndex: 9 });
  const db = database(t, { disciplines: [discipline("a"), discipline("b")], subjects: [subject("topic", "a")], entries: [existing] });
  assert.deepEqual(await buildStudyGuideCycle("user", "guide"), { subjects: 0, entries: 0 });
  assert.deepEqual(db.entries, [existing]);
  assert.equal(db.subjects.length, 1);
});

test("todos os assuntos pausados não são substituídos por Estudo geral", async (t) => {
  const db = database(t, { disciplines: [discipline("a")], subjects: [subject("topic", "a", { active: false })] });
  assert.deepEqual(await buildStudyGuideCycle("user", "guide"), { subjects: 0, entries: 0 });
  assert.equal(db.subjects[0].active, false);
  assert.equal(db.entries.length, 0);
});

test("falha na posição desfaz também matéria e assunto da mesma transação", async (t) => {
  const db = database(t, { failEntry: true });
  await assert.rejects(createStudyDiscipline("user", "guide", { name: "Português", sortOrder: null }), /Falha/);
  assert.equal(db.disciplines.length + db.subjects.length + db.entries.length, 0);
});

test("recuperação recusa guia de outra conta antes de alterar dados", async (t) => {
  const db = database(t, { disciplines: [discipline("a")] });
  await assert.rejects(buildStudyGuideCycle("foreign", "guide"), /Guia não encontrado/);
  assert.equal(db.subjects.length + db.entries.length, 0);
});

test("retry offline não altera uma matéria já sincronizada nem recria posição removida", async (t) => {
  const existing = discipline("offline-id", { name: "Editada", active: false });
  const db = database(t, { disciplines: [existing] });
  await createStudyDiscipline("user", "guide", { id: "offline-id", name: "Antiga", sortOrder: null });
  assert.deepEqual(db.disciplines, [existing]);
  assert.equal(db.subjects.length + db.entries.length, 0);
});

test("ativar matéria antiga completa o cadastro e repetir a ação não inverte nem duplica", async (t) => {
  const existingEntry = entry("portuguese-entry", "portuguese", "portuguese-subject", { orderIndex: 4 });
  const db = database(t, { disciplines: [discipline("english", { active: false })], entries: [existingEntry] });
  await setStudyDisciplineActive("user", "guide", "english", true);
  await setStudyDisciplineActive("user", "guide", "english", true);
  assert.equal(db.disciplines[0].active, true);
  assert.equal(db.subjects.length, 1);
  assert.equal(db.entries.length, 2);
  assert.equal(db.entries[1].orderIndex, 5);
  assert.deepEqual(db.entries[0], existingEntry);
  await setStudyDisciplineActive("user", "guide", "english", false);
  await setStudyDisciplineActive("user", "guide", "english", false);
  assert.equal(db.disciplines[0].active, false);
  await setStudyDisciplineActive("user", "guide", "english", true);
  assert.equal(db.entries.length, 2);
  assert.equal(db.subjects.length, 1);
});

test("ativação preserva pausas explícitas de assuntos e posições", async (t) => {
  const pausedEntry = entry("paused-entry", "english", "topic", { active: false });
  const pausedSubject = subject("topic", "english", { active: false });
  const db = database(t, { disciplines: [discipline("english", { active: false })], subjects: [pausedSubject], entries: [pausedEntry] });
  await setStudyDisciplineActive("user", "guide", "english", true);
  assert.equal(db.disciplines[0].active, true);
  assert.deepEqual(db.subjects, [pausedSubject]);
  assert.deepEqual(db.entries, [pausedEntry]);
});

test("falha ao preparar ciclo desfaz também a reativação", async (t) => {
  const db = database(t, { disciplines: [discipline("english", { active: false })], failEntry: true });
  await assert.rejects(setStudyDisciplineActive("user", "guide", "english", true), /Falha/);
  assert.equal(db.disciplines[0].active, false);
  assert.equal(db.subjects.length + db.entries.length, 0);
});

test("ativação não altera matéria pertencente a outro guia ou usuário", async (t) => {
  const foreign = discipline("foreign", { userId: "foreign", active: false });
  const other = discipline("other", { studyGuideId: "other", active: false });
  const db = database(t, { disciplines: [foreign, other] });
  assert.equal(await setStudyDisciplineActive("user", "guide", "foreign", true), null);
  assert.equal(await setStudyDisciplineActive("user", "guide", "other", true), null);
  assert.deepEqual(db.disciplines, [foreign, other]);
  assert.equal(db.subjects.length + db.entries.length, 0);
});

test("editar matéria que já estava ativa não recria um ciclo removido", async (t) => {
  const db = database(t, { disciplines: [discipline("english")] });
  await setStudyDisciplineActive("user", "guide", "english", true, { name: "Inglês" });
  assert.equal(db.disciplines[0].name, "Inglês");
  assert.equal(db.subjects.length + db.entries.length, 0);
});

test("cadastro offline já oferece estudo no ciclo e enfileira uma criação atômica", (t) => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  }, dispatchEvent: () => true } as unknown as Window & typeof globalThis;
  t.after(() => { globalThis.window = previousWindow; });
  setOfflineAccess({ email: "user@example.com", userId: "user", name: "User", unlockedAt: "now" });
  const snapshot: OfflineSnapshot = { version: 2, user: { id: "user", name: "User", email: "user@example.com" }, guides: [{ id: "guide", serverId: "guide", name: "Guide", icon: "book-open", color: "blue", description: null }], activeGuideId: "guide", settings: null, disciplines: [], subjects: [], cycleEntries: [], sessions: [], pendingOperations: [], lastSyncedAt: null };
  setOfflineSnapshot(snapshot);
  createOfflineDiscipline({ guideId: "guide", name: "Português", category: null, sortOrder: null });
  createOfflineDiscipline({ guideId: "guide", name: "Ética", category: null, sortOrder: null });
  const saved = getOfflineSnapshot();
  assert.equal(saved.subjects.length, 2);
  assert.deepEqual(saved.cycleEntries.map((e) => e.orderIndex), [1, 2]);
  assert.equal(saved.subjects[0].id, generalStudySubjectId(saved.disciplines[0].id));
  assert.equal(saved.cycleEntries[0].id, initialCycleEntryId(saved.disciplines[0].id));
  assert.equal(saved.pendingOperations.length, 2);
  assert.ok(saved.pendingOperations.every((op) => op.entity === "discipline" && op.action === "create"));
  assert.equal(getOfflineNextSuggestion(saved).next?.subjectId, saved.subjects[0].id);
  setOfflineSnapshot({ ...saved, disciplines: [...saved.disciplines, { id: "english", serverId: "english", guideId: "guide", name: "Inglês", category: null, sortOrder: null, active: false }] });
  const details = { name: "Inglês", category: null, sortOrder: null, active: true };
  updateOfflineDiscipline("english", details);
  updateOfflineDiscipline("english", details);
  assert.equal(getOfflineSnapshot().subjects.length, 3);
  assert.equal(getOfflineSnapshot().cycleEntries.length, 3);
  assert.equal(getOfflineSnapshot().cycleEntries[2].orderIndex, 3);
  updateOfflineDiscipline("english", { ...details, active: false });
  updateOfflineDiscipline("english", details);
  assert.equal(getOfflineSnapshot().subjects.length, 3);
  assert.equal(getOfflineSnapshot().cycleEntries.length, 3);
  const cleared = getOfflineSnapshot();
  setOfflineSnapshot({ ...cleared, cycleEntries: cleared.cycleEntries.filter((entry) => entry.subjectId !== generalStudySubjectId("english")) });
  updateOfflineDiscipline("english", { ...details, name: "Inglês atualizado" });
  assert.equal(getOfflineSnapshot().cycleEntries.length, 2);
});
