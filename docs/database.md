# Banco de dados

A migration `20260724090000_phase1_active_study_session` é aditiva: cria `ActiveStudySession`, enums, índices e versionamento de ciclo. `CycleEntry.subjectId` não foi removido. O índice parcial de sessão aberta garante uma única sessão ativa por usuário e guia.

A migration aditiva `20260725180000_phase4_offline_operation_ledger` cria `OfflineOperation`. O ledger possui `operationId` único, hash canônico do payload, estado, tentativas, resposta confirmada e versão para lease otimista. Nenhuma coluna ou tabela anterior foi removida.

`StudySession.activeStudySessionId` é único. Por isso uma `ActiveStudySession` só pode originar um histórico, e revisões, métricas e cursor só são alterados dentro da mesma transação que cria esse histórico.
