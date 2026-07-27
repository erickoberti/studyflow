# Estabilização após a Fase 5

## Cobertura

A auditoria percorre autenticação, troca de guia, dashboard, ciclo, sessão ativa, estudo avulso, histórico, revisões, simulação, simulados, planejamento, modo offline e PWA.

Os testes E2E usam Chrome em 1280 px, 820 px e perfil Pixel 5. São validados redirecionamento autenticado, semântica do login, foco por teclado, tema escuro, ausência de rolagem horizontal, retomada offline, navegação online somente leitura, manifesto e service worker.

## Correções principais

- histórico de migrations reconciliado sem reset; migrations aditivas das Fases 4 e 5 aplicadas;
- tempo estudado hoje separado do acumulado histórico;
- cursor e volta do ciclo lidos de `StudyGuideCycleState`;
- meta semanal calculada apenas com a semana corrente;
- indicadores fictícios removidos;
- consulta resumida do dashboard evita carregar todo o histórico de simulados;
- formulários tratam falhas de rede e bloqueiam envio duplicado;
- estados globais de loading, erro e 404;
- skip link, foco visível, movimento reduzido e navegações nomeadas;
- indicador PWA não sobrepõe a navegação móvel;
- arquivos antigos de SQLite e ícones não utilizados removidos.

## Observabilidade

Erros capturados pelo boundary autenticado são enviados de forma sanitizada para `/api/client-errors` e registrados em JSON no log do servidor. Nenhuma stack, credencial ou payload de estudo é transmitido.

## Segurança e dependências

Atualizações compatíveis do npm foram aplicadas, incluindo NextAuth e Playwright. Alertas residuais de Next.js 14, `next-pwa` e `xlsx` exigem migração de versão ou substituição de biblioteca e não foram corrigidos com `--force`, pois isso introduziria mudanças incompatíveis fora da estabilização.
