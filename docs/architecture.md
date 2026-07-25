# Arquitetura — Fase 1

`CycleService` é a única camada online para posição atual, sugestão, prévia e ciclo de vida da sessão. Componentes recebem DTOs estáveis; a posição vem de `CycleEntry.discipline`, a escolha vem do motor weighted round robin e o histórico vem de `StudySession.subject`.

`CycleEntry.subjectId` permanece no schema exclusivamente para leitura de históricos anteriores. Ele não define uma posição nova do ciclo.

Na Fase 3, `cycle-engine.ts` passou a expor contratos puros de simulação e validação. `cycle-debug.ts` apenas adapta dados persistidos ao motor; a interface, o diagnóstico e a exportação não criam um algoritmo paralelo.
