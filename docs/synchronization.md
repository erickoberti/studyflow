# Sincronização idempotente

Cada comando possui um `operationId` imutável. O cliente mantém a operação no IndexedDB e o servidor mantém um ledger durável com hash do payload, tentativas, versão e resposta confirmada.

## Política

- Mesmo `operationId` e payload reproduzem a resposta sem repetir o efeito.
- Reutilização com payload, usuário ou guia diferente resulta em `CONFLICT`.
- Uma versão local antiga nunca substitui a versão do servidor.
- Finalizações iguais são idempotentes; resultados diferentes preservam a primeira confirmação e geram conflito.
- Operações dependentes param quando uma anterior entra em conflito.
- Erros de validação ficam `CANCELLED`, falhas transitórias ficam `FAILED` e conflitos ficam `CONFLICT`.

O evento `online`, alterações na fila e navegação autenticada acionam a reconciliação. Respostas `202`, `408`, `425`, `429` e `5xx` usam retry exponencial com o mesmo identificador. Depois do limite, a operação permanece `FAILED` para nova tentativa.

Sessão, progresso, revisões, métricas e cursor são atualizados na mesma transação. O lock por `version`, o vínculo único entre `StudySession` e `ActiveStudySession` e o ledger impedem duplicidade e avanço duplo.
