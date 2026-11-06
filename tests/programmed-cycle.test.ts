import assert from "node:assert/strict";
import test from "node:test";
import { assertFixedPositions, defaultProgramRows, matchingMatter, nextProgramPosition, programInputSchema, programReviewIntervals } from "../src/lib/programmed-cycle";

test("modelo tem 16 posições, quatro assuntos por posição e 280 questões por volta", () => {
  const rows = defaultProgramRows();
  assert.equal(rows.length, 16);
  assert.equal(rows.reduce((sum, row) => sum + row.questionGoal, 0), 280);
  assert.ok(rows.every(row => row.topics.length === 4 && row.topics.every(topic => topic.tecStatus === "SUGGESTED" && !topic.tecTopic && !topic.tecDiscipline)));
  assert.equal(rows[6].matter, "Algoritmos e Estruturas de Dados");
  assert.equal(rows[15].topics[3].name, "LGPD");
  assert.equal(programInputSchema.safeParse({ version: 0, rows }).success, true);
});
test("cursor na posição 16 não encerra a volta com posições ainda pendentes", () => {
  const entries = Array.from({ length: 16 }, (_, index) => ({ id: String(index + 1), orderIndex: index + 1, active: true }));
  assertFixedPositions(entries);
  assert.equal(nextProgramPosition(entries, new Set(["16"]), 16)?.orderIndex, 1);
  assert.equal(nextProgramPosition(entries, new Set(entries.map(entry => entry.id)), 16), null);
  assert.throws(() => assertFixedPositions(entries.slice(0, 15)), /16 posições/);
});
test("referências Tec aceitam correção explícita e rejeitam links executáveis ou posições duplicadas", () => {
  const rows = defaultProgramRows(); rows[0].topics[0].tecUrl = "javascript:alert(1)";
  assert.equal(programInputSchema.safeParse({ version: 0, rows }).success, false);
  rows[0].topics[0].tecUrl = "https://www.tecconcursos.com.br/questoes";
  assert.equal(programInputSchema.safeParse({ version: 0, rows }).success, true);
  rows[15].position = 1;
  assert.equal(programInputSchema.safeParse({ version: 0, rows }).success, false);
  assert.equal(matchingMatter("Língua Portuguesa", [{ name: "Português", id: "old" }])?.id, "old");
});
test("revisões respeitam os limiares de 60 e 80 sem bloquear o avanço", () => {
  assert.deepEqual(programReviewIntervals(100, 59), [1,7,30]);
  assert.deepEqual(programReviewIntervals(100, 60), [7,30]);
  assert.deepEqual(programReviewIntervals(100, 79), [7,30]);
  assert.deepEqual(programReviewIntervals(100, 80), [30]);
  assert.deepEqual(programReviewIntervals(0, 0), []);
});
