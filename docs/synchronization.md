# Sincronização idempotente

Cada comando de sessão possui um `operationId` imutável. O cliente mantém a operação no IndexedDB e o servidor mantém um ledger durável com hash do payload, tentativas, versão e resposta confirmada.

## Política de conflito

- O mesmo `operationId` e o mesmo payload reproduzem a resposta confirmada, sem executar novamente o efeito.
- Reutilizar um `operationId` com payload, usuário ou guia diferente resulta em `CONFLICT`.
- Uma versão local anterior à versão da `ActiveStudySession` nunca substitui a versão do servidor.
- Se dois dispositivos finalizarem a mesma sessão com dados iguais, a segunda confirmação é idempotente.
- Se os dados de finalização forem diferentes, a primeira finalização confirmada permanece imutável e a outra operação fica em `CONFLICT`.
- Operações dependentes param quando uma operação anterior entra em conflito.
- Falhas HTTP temporárias, `202`, timeout, limite de requisições e erros `5xx` usam retry exponencial com o mesmo `operationId`.
- Erros de validação ficam `CANCELLED`; falhas transitórias ficam `FAILED`; conflitos exigem reconciliação futura e ficam `CONFLICT`.

Sessão, progresso, revisões, métricas e cursor são atualizados na mesma transação de finalização. O lock otimista por `version`, o vínculo único entre `StudySession` e `ActiveStudySession` e o ledger impedem duplicidade e avanço duplo.
