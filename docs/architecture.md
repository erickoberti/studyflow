# Arquitetura

`CycleService` é a única camada online para posição atual, sugestão, prévia e ciclo de vida da sessão. A posição vem de `CycleEntry.discipline`, a escolha vem do Weighted Round Robin e o histórico vem de `StudySession.subject`. `CycleEntry.subjectId` permanece apenas para compatibilidade com dados anteriores.

Na Fase 3, `cycle-engine.ts` passou a expor contratos puros de simulação e validação. A interface, o diagnóstico, as análises e a exportação usam a mesma saída sem criar algoritmo paralelo.

## Offline e PWA

A sessão ativa possui espelho local no IndexedDB e fila ordenada por `operationId`. `session-sync-engine.ts` é o reconciliador independente da UI; `offline-operation-ledger.ts` garante idempotência durável no servidor. O `CycleService` mantém lock otimista e executa sessão, progresso, revisões, métricas e cursor em uma transação.

O service worker nunca é fonte de dados autenticados. Ele guarda apenas shell público e assets; APIs e páginas autenticadas usam rede ou fallback offline explícito.

## Simulados e planejamento

`MockExam` e `MockExamDisciplineResult` formam um domínio separado de `StudySession`. A API de simulados calcula agregados no servidor e não chama `CycleService`, não atualiza `SubjectProgress` e não move o cursor. O nome da disciplina é armazenado como snapshot, preservando o histórico se a base for reorganizada.

`SyllabusProgress` registra a cobertura do edital por assunto. `phase-five.ts` contém funções puras para distribuição, planejamento e recomendações; `phase-five-service.ts` compõe os dados do guia para dashboard e telas. Todas as consultas são filtradas por `userId` e `studyGuideId`.

## Resiliência

O segmento autenticado possui boundaries de loading e erro. Falhas de renderização podem ser reenviadas, sem dados sensíveis, para `/api/client-errors`; o servidor registra eventos estruturados em JSON. A suíte Playwright cobre os fluxos principais em desktop, tablet e celular.
