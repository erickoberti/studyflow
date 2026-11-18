# Sessão de estudo

Estados: `ACTIVE`, `PAUSED`, `FINISHING`, `FINISHED` e `CANCELLED`. O registro manual é o fluxo padrão e cria a mesma sessão em `PAUSED`; o cronômetro opcional cria ou retoma em `ACTIVE`. O tempo visível é reconstruído com `accumulatedSeconds`, `startedAt` e o marco de retomada, sem depender de um contador contínuo no navegador. Pausa e retomada usam `version`; finalização aceita a correção manual dos minutos e grava `StudySession.activeStudySessionId` de forma única, tornando repetição idempotente. Cancelamento preserva auditoria e não cria histórico, progresso ou avanço.

Cada histórico possui `activityType`: `QUESTIONS`, `CLASS`, `READING` ou `REVIEW`. Aulas e leituras aceitam zero questões e preservam tempo, passagem e assunto. A finalização também recebe `advanceCycle`; quando falso, salva a atividade sem mover o cursor nem contabilizar uma posição concluída.

`StudySession.scope` distingue sessões de ciclo (`CYCLE`), registros ligados a um assunto (`SUBJECT`) e revisões gerais (`GENERAL`). A revisão geral aceita acertos, erros e duração sem `subjectId` ou `cycleEntryId`: entra nos totais, metas e calendário, mas não atualiza `SubjectProgress`, não conclui `ReviewSchedule` e não altera o cursor.

O endpoint legado `/api/study-sessions` é registro avulso de compatibilidade e não avança o ciclo. O fluxo de ciclo usa `/api/active-study-session`.

O início da sessão, manual ou com cronômetro, usa uma transação com prazo de 20 segundos para acomodar a latência do banco remoto. A seleção do assunto, a validação da programação e a criação permanecem sob a mesma trava do guia. As relações usadas apenas para exibição são carregadas depois do commit, reduzindo o tempo da transação e da trava. Repetições por `operationId` e a retomada de sessões abertas preservam a mesma sessão, inclusive na sincronização offline.

A finalização mantém histórico, progresso, revisões e cursor em uma única transação, com prazo de 20 segundos para acomodar latência do banco remoto. Os totais são recalculados uma única vez a partir do histórico. Após bloquear os assuntos, os pesos são atualizados em lotes por incremento, evitando uma escrita por assunto. Repetir uma finalização já concluída não duplica o registro nem avança novamente o ciclo.
