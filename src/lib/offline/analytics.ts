import type { OfflineSettings, OfflineSnapshot, OfflineStudySession } from "@/lib/offline/types";
import { expandOfflineEntry, getDisciplineMap, getOfflineCycleEntries, getSubjectMap } from "@/lib/offline/selectors";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function diffCalendarDaysUTC(aKey: string, bKey: string) {
  const a = parseDayKey(aKey).getTime();
  const b = parseDayKey(bKey).getTime();
  return Math.round((a - b) / 86_400_000);
}

function activeEntries(snapshot: OfflineSnapshot) {
  const subjectMap = getSubjectMap(snapshot);
  const disciplineMap = getDisciplineMap(snapshot);
  return getOfflineCycleEntries(snapshot, snapshot.activeGuideId)
    .filter((entry) => entry.active)
    .map((entry) => expandOfflineEntry(entry, subjectMap, disciplineMap))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function activeSessions(sessions: OfflineStudySession[]) {
  return sessions
    .filter((session) => session.syncStatus !== "pending_delete")
    .sort((a, b) => {
      const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (byDate !== 0) return byDate;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function getOfflineNextSuggestion(snapshot: OfflineSnapshot) {
  const entries = activeEntries(snapshot);
  const sessions = activeSessions(snapshot.sessions);

  if (!entries.length) {
    return { last: null, next: null };
  }

  const lastSession = sessions[0];
  if (!lastSession) {
    return { last: null, next: entries[0] };
  }

  const currentEntry = entries.find((entry) => entry.id === lastSession.cycleEntryId) ?? null;
  if (!currentEntry) {
    return { last: null, next: entries[0] };
  }

  const next = entries.find((entry) => entry.orderIndex > currentEntry.orderIndex) ?? entries[0];
  return { last: currentEntry, next };
}

export function getOfflineDashboard(snapshot: OfflineSnapshot) {
  const sessions = activeSessions(snapshot.sessions);
  const settings: OfflineSettings = snapshot.settings ?? {
    targetPercentage: 80,
    dailyQuestionsGoal: 30,
    weeklyQuestionsGoal: 200,
    weightPriorityBias: 1.25,
  };

  const subjectMap = getSubjectMap(snapshot);
  const disciplineMap = getDisciplineMap(snapshot);
  const entryMap = new Map(
    getOfflineCycleEntries(snapshot, snapshot.activeGuideId)
      .map((entry) => expandOfflineEntry(entry, subjectMap, disciplineMap))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => [entry.id, entry]),
  );
  const totalQuestions = sessions.reduce((sum, item) => sum + item.questions, 0);
  const totalCorrect = sessions.reduce((sum, item) => sum + item.correct, 0);
  const totalWrong = sessions.reduce((sum, item) => sum + item.wrong, 0);
  const totalEstimatedMinutes = sessions.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const overallPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  const byDay = new Map<string, { date: string; questions: number; correct: number; percentage: number }>();
  const byDiscipline = new Map<string, { discipline: string; questions: number; correct: number }>();
  const bySubject = new Map<string, { discipline: string; subject: string; questions: number; correct: number; weight: number }>();
  const recentByEntry = new Map<string, number>();
  const todayKey = dayKey(new Date());

  for (const session of sessions) {
    const entry = entryMap.get(session.cycleEntryId);
    if (!entry) continue;

    const sessionDayKey = dayKey(new Date(session.date));
    const dayDistance = diffCalendarDaysUTC(todayKey, sessionDayKey);
    if (dayDistance >= 0 && dayDistance <= 29) {
      recentByEntry.set(entry.id, (recentByEntry.get(entry.id) ?? 0) + 1);
    }

    const dayData = byDay.get(sessionDayKey) ?? { date: sessionDayKey, questions: 0, correct: 0, percentage: 0 };
    dayData.questions += session.questions;
    dayData.correct += session.correct;
    dayData.percentage = dayData.questions > 0 ? (dayData.correct / dayData.questions) * 100 : 0;
    byDay.set(sessionDayKey, dayData);

    const disciplineName = entry.subject.discipline.name;
    const disciplineData = byDiscipline.get(disciplineName) ?? { discipline: disciplineName, questions: 0, correct: 0 };
    disciplineData.questions += session.questions;
    disciplineData.correct += session.correct;
    byDiscipline.set(disciplineName, disciplineData);

    const subjectKey = `${disciplineName}::${entry.subject.name}`;
    const subjectData =
      bySubject.get(subjectKey) ??
      {
        discipline: disciplineName,
        subject: entry.subject.name,
        questions: 0,
        correct: 0,
        weight: entry.subject.weight,
      };
    subjectData.questions += session.questions;
    subjectData.correct += session.correct;
    bySubject.set(subjectKey, subjectData);
  }

  const byDayList = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  let streakDays = 0;
  if (byDayList.length > 0) {
    streakDays = 1;
    for (let idx = byDayList.length - 1; idx > 0; idx -= 1) {
      const diff = diffCalendarDaysUTC(byDayList[idx].date, byDayList[idx - 1].date);
      if (diff === 1) {
        streakDays += 1;
      } else {
        break;
      }
    }
  }

  return {
    totals: {
      totalQuestions,
      totalCorrect,
      totalWrong,
      totalEstimatedMinutes,
      overallPercentage,
      dailyQuestionsGoal: settings.dailyQuestionsGoal,
      weeklyQuestionsGoal: settings.weeklyQuestionsGoal,
      streakDays,
      cyclePasses: activeEntries(snapshot).length
        ? Math.min(...activeEntries(snapshot).map((entry) => recentByEntry.get(entry.id) ?? 0))
        : 0,
    },
    byDay: byDayList,
    disciplineStats: Array.from(byDiscipline.values()).map((item) => ({
      ...item,
      percentage: item.questions > 0 ? (item.correct / item.questions) * 100 : 0,
    })),
    subjectStats: Array.from(bySubject.values())
      .map((item) => ({
        ...item,
        percentage: item.questions > 0 ? (item.correct / item.questions) * 100 : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage),
  };
}
