# Banco de dados — Fase 1

A migration `20260724090000_phase1_active_study_session` é estritamente aditiva: cria `ActiveStudySession`, dois enums, índices e as colunas `StudyGuideCycleState.version` e `StudySession.activeStudySessionId`. Não há `DROP`, `DELETE`, reset ou alteração de `CycleEntry.subjectId`.

O índice parcial `ActiveStudySession_one_open_per_guide` garante no banco uma única sessão aberta por usuário e guia.
