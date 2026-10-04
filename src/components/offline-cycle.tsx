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

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-surface shadow-sm dark:border-white/5 dark:bg-slate-950/70">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-textSecondary dark:bg-elevated">
            <tr>
              <th className="px-4 py-3">Ordem</th>
              <th className="px-4 py-3">Disciplina</th>
              <th className="px-4 py-3">Assunto</th>
              <th className="px-4 py-3 text-right">Questões</th>
              <th className="px-4 py-3 text-right">Acerto</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cycleEntries.map((entry) => {
              const aggregate = sessionsByEntry.get(entry.id) ?? { questions: 0, correct: 0 };
              const percentage = aggregate.questions > 0 ? (aggregate.correct / aggregate.questions) * 100 : 0;

              return (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-semibold">#{entry.orderIndex}</td>
                  <td className="px-4 py-3">{entry.subject.discipline.name}</td>
                  <td className="px-4 py-3">{entry.subject.name}</td>
                  <td className="px-4 py-3 text-right">{aggregate.questions}</td>
                  <td className="px-4 py-3 text-right">{percentage.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${entry.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-textSecondary dark:bg-elevated dark:text-textSecondary"}`}>
                      {entry.active ? "ativo" : "inativo"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
