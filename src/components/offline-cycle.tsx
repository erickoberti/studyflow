"use client";

import { useEffect, useMemo, useState } from "react";
import { getOfflineSnapshot, subscribeOfflineStore } from "@/lib/offline/store";
import { expandOfflineEntry, getActiveOfflineGuide, getDisciplineMap, getOfflineCycleEntries, getSubjectMap } from "@/lib/offline/selectors";

export function OfflineCycle() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot());

  useEffect(() => subscribeOfflineStore(() => setSnapshot(getOfflineSnapshot())), []);

  const activeGuide = getActiveOfflineGuide(snapshot);
  const subjectMap = getSubjectMap(snapshot);
  const disciplineMap = getDisciplineMap(snapshot);
  const cycleEntries = getOfflineCycleEntries(snapshot, activeGuide?.id)
    .map((entry) => expandOfflineEntry(entry, subjectMap, disciplineMap))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const sessionsByEntry = useMemo(() => {
    const map = new Map<string, { questions: number; correct: number }>();
    for (const session of snapshot.sessions) {
      if (session.syncStatus === "pending_delete" || !session.cycleEntryId || session.scope === "SUBJECT" || session.scope === "GENERAL") continue;
      const current = map.get(session.cycleEntryId) ?? { questions: 0, correct: 0 };
      current.questions += session.questions;
      current.correct += session.correct;
      map.set(session.cycleEntryId, current);
    }
    return map;
  }, [snapshot.sessions]);

  return (
    <div className="space-y-5 pb-10">
      <header>
        <h2 className="text-3xl font-semibold">Ciclo local</h2>
        <p className="mt-1 text-sm text-textSecondary">Consulta offline do ciclo atual. Alterações estruturais continuam online.</p>
      </header>

      <section aria-label="Sequência salva offline" className="rounded-card border bg-surface">
        <ol className="divide-y">
            {cycleEntries.map((entry) => {
              const aggregate = sessionsByEntry.get(entry.id) ?? { questions: 0, correct: 0 };
              const percentage = aggregate.questions > 0 ? (aggregate.correct / aggregate.questions) * 100 : 0;

              return (
                <li key={entry.id} className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 p-4 text-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-control bg-elevated text-xs font-semibold">{entry.orderIndex}</span>
                  <div><p><strong>{entry.subject.discipline.name}</strong> → {entry.subject.name}</p>
                    <p className="mt-1 text-xs text-textSecondary">{entry.active ? "Ativo" : "Pausado"} · {aggregate.questions} questões · {aggregate.questions ? `${percentage.toFixed(1)}% de acertos` : "sem questões registradas"}</p>
                  </div>
                </li>
              );
            })}
        </ol>
        {!cycleEntries.length ? <p className="p-5 text-sm text-textSecondary">Nenhuma posição disponível neste guia local.</p> : null}
      </section>
    </div>
  );
}
