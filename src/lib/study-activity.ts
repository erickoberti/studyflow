export const STUDY_ACTIVITY_TYPES = ["QUESTIONS", "CLASS", "READING", "PDF_READING", "REVIEW"] as const;

export type StudyActivity = (typeof STUDY_ACTIVITY_TYPES)[number];

export const STUDY_ACTIVITY_LABELS: Record<StudyActivity, string> = {
  QUESTIONS: "Questões",
  CLASS: "Videoaula",
  READING: "Lei seca",
  PDF_READING: "PDF/material",
  REVIEW: "Revisão",
};

export function studyActivityLabel(activityType: StudyActivity) {
  return STUDY_ACTIVITY_LABELS[activityType];
}
