import assert from "node:assert/strict";
import test from "node:test";
import { currentStudyStreak, normalizeStudySearch, safeStudyUrl, studyDayKey, studyWeek } from "../src/lib/study-insights";
import { formatTecReference, parseTecReference } from "../src/lib/tec-reference";

test("semana começa na segunda no fuso de São Paulo, inclusive na virada UTC", () => {
  const now = new Date("2026-11-09T01:30:00Z"); // Sunday, 22:30 in São Paulo
  assert.equal(studyDayKey(now), "2026-11-08");
  const week = studyWeek([{ date: "2026-11-08", questions: 20, correct: 16, estimatedMinutes: 45 }], now);
  assert.equal(week[0].date, "2026-11-02");
  assert.equal(week.at(-1)?.date, "2026-11-08");
  assert.equal(week.filter(day => day.today).length, 1);
  assert.equal(week.at(-1)?.minutes, 45);
  assert.equal(week.reduce((sum, day) => sum + day.questions, 0), 20);
});

test("sequência considera hoje ou ontem e zera após interrupção, ignorando datas futuras", () => {
  const now = new Date("2026-11-06T15:00:00Z");
  assert.equal(currentStudyStreak([], now), 0);
  assert.equal(currentStudyStreak(["2026-11-01", "2026-11-02"], now), 0);
  assert.equal(currentStudyStreak(["2026-11-04", "2026-11-05", "2026-11-05"], now), 2);
  assert.equal(currentStudyStreak(["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"], now), 3);
  assert.equal(currentStudyStreak(["2026-11-06", "2026-11-07"], now), 1);
});

test("busca encontra termos sem exigir acentos ou caixa", () => {
  assert.ok(normalizeStudySearch("Segurança → Criptografia assimétrica").includes(normalizeStudySearch("ASSIMETRICA")));
});

test("referências antigas continuam legíveis e nunca recebem confirmação automática", () => {
  const text = "Banco de Dados → SELECT https://www.tecconcursos.com.br/caderno/123";
  const result = parseTecReference(text);
  assert.equal(result.topic, text);
  assert.equal(result.status, "SUGGESTED");
  assert.equal(result.url, "https://www.tecconcursos.com.br/caderno/123");
  assert.equal(parseTecReference(null).topic, "");
});

test("cadastro Tec preserva tópico, link e classificação em formato legível e reversível", () => {
  const value = formatTecReference("SQL → JOIN", "https://www.tecconcursos.com.br/cadernos/123", "CONFIRMED");
  assert.deepEqual(parseTecReference(value), { topic: "SQL → JOIN", url: "https://www.tecconcursos.com.br/cadernos/123", status: "CONFIRMED" });
  assert.equal(formatTecReference("", "", "CONFIRMED"), null);
  assert.equal(parseTecReference(formatTecReference("SQL", "", "SUGGESTED")).status, "SUGGESTED");
});

test("atalhos de caderno recusam protocolos executáveis e URLs inválidas", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>", "//evil.example", "não é um link"]) {
    assert.equal(safeStudyUrl(url), null);
    assert.throws(() => formatTecReference("SQL", url, "SUGGESTED"), /HTTP/);
  }
});
