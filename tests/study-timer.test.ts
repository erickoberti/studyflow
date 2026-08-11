import assert from "node:assert/strict";
import test from "node:test";
import { calculateElapsedSeconds } from "../src/lib/study-timer";

test("reconstrói o tempo ativo após recarregar ou reabrir o navegador", () => {
  const session = {
    status: "ACTIVE" as const,
    startedAt: "2026-08-07T10:00:00.000Z",
    pausedAt: "2026-08-07T10:00:00.000Z",
    accumulatedSeconds: 0,
  };
  assert.equal(calculateElapsedSeconds(session, "2026-08-07T10:42:15.000Z"), 2535);
});

test("aba suspensa não perde tempo porque o cálculo usa timestamps", () => {
  const session = {
    status: "ACTIVE" as const,
    startedAt: "2026-08-07T10:00:00.000Z",
    pausedAt: "2026-08-07T10:10:00.000Z",
    accumulatedSeconds: 600,
  };
  assert.equal(calculateElapsedSeconds(session, "2026-08-07T10:40:00.000Z"), 2400);
});

test("sessão pausada mantém apenas o tempo acumulado", () => {
  const session = {
    status: "PAUSED" as const,
    startedAt: "2026-08-07T10:00:00.000Z",
    pausedAt: null,
    accumulatedSeconds: 725,
  };
  assert.equal(calculateElapsedSeconds(session, "2026-08-08T10:00:00.000Z"), 725);
});

test("sessão ativa legada usa startedAt quando não há marco de retomada", () => {
  const session = {
    status: "ACTIVE" as const,
    startedAt: "2026-08-07T10:00:00.000Z",
    pausedAt: null,
    accumulatedSeconds: 0,
  };
  assert.equal(calculateElapsedSeconds(session, "2026-08-07T10:05:00.000Z"), 300);
});
