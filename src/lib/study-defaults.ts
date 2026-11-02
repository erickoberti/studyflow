export const GENERAL_STUDY_SUBJECT_NAME = "Estudo geral";

// Stable IDs keep the initial study created offline and on the server identical.
export const generalStudySubjectId = (disciplineId: string) => `general-${disciplineId}`;
export const initialCycleEntryId = (disciplineId: string) => `initial-cycle-${disciplineId}`;
