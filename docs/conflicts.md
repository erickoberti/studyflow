# Conflitos offline

O servidor é a fonte de verdade para versões confirmadas. Nenhuma operação local baseada em versão antiga sobrescreve silenciosamente uma `ActiveStudySession` mais recente.

Conflitos ocorrem quando o mesmo `operationId` é reutilizado com outro payload, quando a sessão mudou em outro dispositivo ou quando duas finalizações apresentam resultados diferentes. A primeira finalização confirmada é imutável.

O indicador global lista tipo, horário, tentativas e motivo. Operações `FAILED` podem ser reenviadas. Operações `CONFLICT` não são repetidas automaticamente; o usuário pode manter o servidor e arquivar a cópia local. O payload permanece no IndexedDB até essa decisão.

Estados: `PENDING`, `SYNCING`, `COMPLETED`, `FAILED`, `CONFLICT` e `CANCELLED`.
