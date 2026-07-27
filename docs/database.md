# Banco de dados

A migration `20260724090000_phase1_active_study_session` é aditiva: cria `ActiveStudySession`, enums, índices e versionamento de ciclo. `CycleEntry.subjectId` não foi removido. O índice parcial de sessão aberta garante uma única sessão ativa por usuário e guia.

A migration `20260725180000_phase4_offline_operation_ledger` cria `OfflineOperation`. O ledger possui `operationId` único, hash canônico do payload, estado, tentativas, resposta confirmada e versão para lease otimista.

`StudySession.activeStudySessionId` é único. Assim uma `ActiveStudySession` só pode originar um histórico, e revisões, métricas e cursor são alterados na mesma transação.

## Fase 5

- `MockExam`: cabeçalho e totais do resultado consolidado.
- `MockExamDisciplineResult`: recorte por disciplina, peso e nome histórico.
- `SyllabusProgress`: status `NOT_STARTED`, `IN_PROGRESS` ou `COMPLETED` por assunto.

A migration `20260726120000_phase5_exam_planning` apenas cria tipos, tabelas, índices e chaves estrangeiras. Resultados de simulado não possuem relação com `StudySession`, `ActiveStudySession`, `StudyGuideCycleState` ou `SubjectProgress`.
