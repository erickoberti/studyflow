# Sessão de estudo

Estados: `ACTIVE`, `PAUSED`, `FINISHING`, `FINISHED` e `CANCELLED`. O cronômetro é reconstruído com `accumulatedSeconds` e o marco de início/retomada. Pausa e retomada usam `version`; finalização grava `StudySession.activeStudySessionId` de forma única, tornando repetição idempotente. Cancelamento preserva auditoria e não cria histórico, progresso ou avanço.

O endpoint legado `/api/study-sessions` é registro avulso de compatibilidade e não avança o ciclo. O fluxo de ciclo usa `/api/active-study-session`.
