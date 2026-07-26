# Arquitetura

`CycleService` é a única camada online para posição atual, sugestão, prévia e ciclo de vida da sessão. A posição vem de `CycleEntry.discipline`, a escolha vem do Weighted Round Robin e o histórico vem de `StudySession.subject`. `CycleEntry.subjectId` permanece apenas para compatibilidade com dados anteriores.

Na Fase 3, `cycle-engine.ts` passou a expor contratos puros de simulação e validação. A interface, o diagnóstico, as análises e a exportação usam a mesma saída sem criar algoritmo paralelo.

## Fase 4

A sessão ativa possui espelho local no IndexedDB e fila ordenada por `operationId`. `session-sync-engine.ts` é o reconciliador independente da UI; `offline-operation-ledger.ts` garante idempotência durável no servidor. O `CycleService` mantém lock otimista e executa sessão, progresso, revisões, métricas e cursor em uma transação.

O service worker nunca é fonte de dados autenticados. Ele guarda apenas shell público e assets; APIs e páginas autenticadas usam rede ou fallback offline explícito.
