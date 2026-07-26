import type { OfflineCycleEntry, OfflineDiscipline, OfflineSnapshot, OfflineSubject } from "@/lib/offline/types";

export function getActiveOfflineGuide(snapshot: OfflineSnapshot) {
  return snapshot.guides.find((guide) => guide.id === snapshot.activeGuideId) ?? snapshot.guides[0] ?? null;
}

export function getOfflineDisciplines(snapshot: OfflineSnapshot, guideId?: string | null) {
  return snapshot.disciplines.filter((discipline) => !guideId || discipline.guideId === guideId);
}

export function getOfflineSubjects(snapshot: OfflineSnapshot, guideId?: string | null) {
  return snapshot.subjects.filter((subject) => !guideId || subject.guideId === guideId);
}

export function getOfflineCycleEntries(snapshot: OfflineSnapshot, guideId?: string | null) {
  return snapshot.cycleEntries
    .filter((entry) => !guideId || entry.guideId === guideId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function getDisciplineMap(snapshot: OfflineSnapshot) {
  return new Map(snapshot.disciplines.map((discipline) => [discipline.id, discipline]));
}

export function getSubjectMap(snapshot: OfflineSnapshot) {
  return new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
}

export function expandOfflineEntry(
  entry: OfflineCycleEntry,
  subjectMap: Map<string, OfflineSubject>,
  disciplineMap: Map<string, OfflineDiscipline>,
) {
  const subject = subjectMap.get(entry.subjectId);
  const discipline = subject ? disciplineMap.get(subject.disciplineId) : null;
  if (!subject || !discipline) return null;

  return {
    ...entry,
    subject: {
      id: subject.id,
      serverId: subject.serverId,
      name: subject.name,
      weight: subject.weight,
      notes: subject.notes,
      tecReference: subject.tecReference,
      active: subject.active,
      discipline: {
        id: discipline.id,
        serverId: discipline.serverId,
        name: discipline.name,
        active: discipline.active,
      },
    },
  };
}
