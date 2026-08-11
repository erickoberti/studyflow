# Sessão de estudo

Estados: `ACTIVE`, `PAUSED`, `FINISHING`, `FINISHED` e `CANCELLED`. O registro manual é o fluxo padrão e cria a mesma sessão em `PAUSED`; o cronômetro opcional cria ou retoma em `ACTIVE`. O tempo visível é reconstruído com `accumulatedSeconds`, `startedAt` e o marco de retomada, sem depender de um contador contínuo no navegador. Pausa e retomada usam `version`; finalização aceita a correção manual dos minutos e grava `StudySession.activeStudySessionId` de forma única, tornando repetição idempotente. Cancelamento preserva auditoria e não cria histórico, progresso ou avanço.

O endpoint legado `/api/study-sessions` é registro avulso de compatibilidade e não avança o ciclo. O fluxo de ciclo usa `/api/active-study-session`.
