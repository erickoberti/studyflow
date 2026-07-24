# Arquitetura — Fase 1

`CycleService` é a única camada online para posição atual, sugestão, prévia e ciclo de vida da sessão. Componentes recebem DTOs estáveis; a posição vem de `CycleEntry.discipline`, a escolha vem do motor weighted round robin e o histórico vem de `StudySession.subject`.

`CycleEntry.subjectId` permanece no schema exclusivamente para leitura de históricos anteriores. Ele não define uma posição nova do ciclo.
