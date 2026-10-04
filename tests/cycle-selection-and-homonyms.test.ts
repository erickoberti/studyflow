import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentCycleEntry } from "../src/lib/cycle-engine";
import { getOfflineDashboard, getOfflineNextSuggestion } from "../src/lib/offline/analytics";
import type { OfflineSnapshot } from "../src/lib/offline/types";

const date = "2026-10-02T12:00:00.000Z";
function snapshot(): OfflineSnapshot {
  return {
    version: 2, user: { id: "user", name: null, email: "user@example.com" },
    guides: [{ id: "guide", serverId: "guide", name: "Guia", icon: "book", color: "blue", description: null }],
    activeGuideId: "guide", cycleCursor: { guideId: "guide", currentOrderIndex: 3 }, settings: null,
    disciplines: [
      { id: "law", serverId: "law", guideId: "guide", name: "Direito", category: null, sortOrder: 1, active: true },
      { id: "tech", serverId: "tech", guideId: "guide", name: "TI", category: null, sortOrder: 2, active: true },
    ],
    subjects: [
      { id: "law-subject", serverId: "law-subject", guideId: "guide", disciplineId: "law", name: "Introdução", weight: 1, notes: null, tecReference: null, active: true, orderIndex: 1 },
      { id: "tech-subject", serverId: "tech-subject", guideId: "guide", disciplineId: "tech", name: "Introdução", weight: 2, notes: null, tecReference: null, active: true, orderIndex: 3 },
    ],
    cycleEntries: [
      { id: "entry-law", serverId: "entry-law", guideId: "guide", subjectId: "law-subject", orderIndex: 1, active: true },
      { id: "entry-tech", serverId: "entry-tech", guideId: "guide", subjectId: "tech-subject", orderIndex: 3, active: true },
    ],
    sessions: [
      { id: "cycle", serverId: "cycle", cycleEntryId: "entry-law", subjectId: "law-subject", scope: "CYCLE", date, questions: 10, correct: 7, wrong: 3, percentage: 70, estimatedMinutes: 20, notes: null, createdAt: date, updatedAt: date, syncStatus: "synced", syncError: null },
      { id: "standalone", serverId: "standalone", cycleEntryId: null, subjectId: "tech-subject", scope: "SUBJECT", date: "2026-10-02T13:00:00.000Z", questions: 20, correct: 15, wrong: 5, percentage: 75, estimatedMinutes: 30, notes: null, createdAt: date, updatedAt: date, syncStatus: "synced", syncError: null },
    ],
    pendingOperations: [], lastSyncedAt: date,
  };
}

test("cursor escolhe a mesma posição ordenada em início, lacuna, fim e lista vazia", () => {
  const entries = [{ orderIndex: 3 }, { orderIndex: 1 }];
  assert.equal(selectCurrentCycleEntry(entries, 1)?.orderIndex, 1);
  assert.equal(selectCurrentCycleEntry(entries, 2)?.orderIndex, 3);
  assert.equal(selectCurrentCycleEntry(entries, 4)?.orderIndex, 1);
  assert.equal(selectCurrentCycleEntry([], 1), null);
});

test("avulso não move sugestão offline e assuntos homônimos não se misturam", () => {
  const data = snapshot();
  assert.equal(getOfflineNextSuggestion(data).next?.id, "entry-tech");
  const subjectStats = getOfflineDashboard(data).subjectStats;
  assert.equal(subjectStats.length, 2);
  assert.deepEqual(subjectStats.map((item) => [item.discipline, item.questions]).sort(), [["Direito", 10], ["TI", 20]]);
  assert.equal(getOfflineDashboard(data).totals.cyclePasses, 0);
});
