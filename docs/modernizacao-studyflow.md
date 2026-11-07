# Diagnóstico e modernização do StudyFlow

## Diagnóstico antes das alterações

A aplicação usa Next.js App Router, NextAuth, Prisma/PostgreSQL e um modo offline com IndexedDB e fila idempotente. `CycleService` é a autoridade para iniciar, pausar, retomar e concluir sessões. O ciclo programado já possui 16 posições, quatro voltas, conclusão por posição/volta, snapshots históricos e matriz editável. Esses mecanismos devem ser preservados.

| Área analisada | Achado e impacto | Decisão |
| --- | --- | --- |
| Painel | Sem progresso semanal; repetição de contexto; assunto sem questões tratado como prioridade alta; desempenho acumulado descrito como ciclo atual | Concentrar próxima ação, semana, revisões e resultados com período explícito |
| Ciclo | Boa sequência de 16 linhas expansíveis; histórico mistura assuntos e voltas; consulta carrega todos os registros completos | Manter mapa e sequência; separar resultado da volta e acumulado; resumir histórico |
| Matriz | Já protege ativação e versões; alterações podem ser perdidas ao sair; referências Tec escondidas | Indicar alterações pendentes, guardar proteção de navegação e tornar referências reutilizáveis |
| Matérias | `groupName` existe, mas não há editor de agrupamento; referência Tec é texto e não há atalho claro às referências estruturadas da programação; exclusões em massa não pedem confirmação | Usar agrupamento existente; expor referências por volta; confirmar exclusões explícitas |
| Estudar | Fluxo principal funcional e persistente; assunto sem resultados recebe prioridade alta; referência Tec não acompanha a sessão; diálogo sem contenção de foco/Escape | Corrigir estados sem dados, levar referência para estudo e melhorar teclado no diálogo |
| Histórico | Snapshots já preservam nomes antigos e há paginação; nenhuma entrada direta a um assunto vindo do ciclo | Preservar edição/exportação e permitir filtro por assunto |
| Revisões | Agenda por assunto e intervalos existem; pendências não aparecem claramente no painel | Mostrar contagem de assuntos vencidos e próxima revisão, sem bloquear ciclo |
| Navegação | Celular oculta destinos no topo e a barra inferior não dá acesso a Mais; ícones de ciclo e revisões iguais | Dar acesso constante a Mais e diferenciar destinos |
| Sistema visual | Paleta e marca já reconhecíveis; regras globais com `:has()` alteram sidebar, cabeçalho e largura conforme a tela; textos de 10–11 px | Unificar shell, tokens, estados de foco e leitura |
| Metas e estatísticas | Metas por tempo e questões existem; sequência de dias ignora quanto tempo passou desde o último estudo | Corrigir consistência temporal e explicitar períodos |
| Planejamento, simulados, guias, configurações | Domínios separados e funcionais; estilos dependem de shell compartilhado | Preservar fluxos e verificar navegação, responsividade e erros |
| Autenticação e offline | Autenticação, isolamento por conta e sincronização já possuem cobertura de regressão | Preservar contratos e testar login, restauração e fila |

## Limites de dados

Nenhum ciclo será criado, apagado, reordenado ou ativado por carregar uma tela. Nenhum conteúdo das quatro voltas será substituído. As referências Tec são cadastradas pelo usuário; não há integração automática. A modernização usa os campos e relações existentes e não requer migração SQL. Agrupamentos são opcionais: registros antigos continuam válidos.

## Verificação

Baseline: 133 testes unitários aprovados; as 14 telas autenticadas foram percorridas em 320, 390, 820 e 1440 px. A comparação dos registros antes/depois dessa auditoria não encontrou alterações em sessões, assuntos, posições ou programação.

## Implementação

- Painel: próxima ação com posição, volta, matéria, assunto, meta e estimativa; semana de segunda a domingo em São Paulo; revisões vencidas contadas por assunto; acertos e erros recentes; desempenho identificado como acumulado do guia. Programações concluídas recebem um estado próprio, sem convite a recriar o ciclo.
- Navegação e design: marca, índigo e fundo claro preservados; shell com largura e espaçamento constantes; retirada das regras que alteravam a navegação conforme a tela visitada; acesso permanente a Mais no celular; tema disponível também em telas pequenas; ícones distintos para ciclo e revisão; estados sem dados e contraste semântico mais legíveis.
- Ciclo: 16 linhas expansíveis e mapa compacto preservados. A programação mostra progresso por volta, resultados da posição/volta separados do acumulado e até cinco sessões recentes por posição. Os totais usam agregação no banco. A estimativa usa a configuração do guia, como no painel.
- Matriz: indicador de alterações pendentes, proteção ao sair por link ou recarregar, identificação da célula atual. Novas voltas não podem ser acrescentadas enquanto houver edição não salva. Os assuntos e as metas das quatro voltas permanecem os existentes.
- Matérias: busca tolerante a acentos e referências Tec; agrupamento opcional de subassuntos; atalhos para histórico e cadernos; acesso às referências programadas por posição/volta. A edição de organização/anotações de assuntos programados não altera conteúdo nem metas da matriz. Exclusões em massa agora exigem confirmação.
- Estudar: assunto em destaque; referência Tec disponível na sessão; estado “Sem questões”; tela avulsa separada do painel do ciclo; entrada pela revisão já seleciona matéria e assunto; contenção/restauração de foco e Escape na finalização; trava imediata contra cliques concorrentes, mantendo a idempotência do servidor.
- Histórico: filtro direto por assunto ou posição; posições vêm do cadastro, evitando repetição por volta e mantendo o filtro disponível em programações concluídas.
- Consistência: sequência de dias considera hoje/ontem e zera após uma interrupção, tanto online quanto offline. Assuntos sem questões deixam de gerar indicação de dificuldade com base em 0% fictício.

## Dados e reversibilidade

Não houve alteração do schema nem execução de migração, seed, importação ou restauração. `Subject.groupName` já existia e passa a guardar o agrupamento opcional. O nome do registro continua sendo a unidade que recebe sessões e resultados; não é criada uma árvore de entidades ou feita redistribuição de resultados antigos.

Nas matérias sem programação, tópico, status e URL são armazenados de forma legível no campo `tecReference` existente, somente após salvar o formulário. O leitor aceita o texto antigo sem modificá-lo nem confirmá-lo automaticamente. Na programação, continuam sendo usados os campos estruturados de `CycleProgramItem`. Links aceitam apenas HTTP/HTTPS. A confirmação é manual e é retirada quando o usuário muda tópico ou link.

Snapshots e backups continuam compatíveis. O bootstrap offline inclui `groupName`; clientes antigos que não enviam esse campo não o apagam ao sincronizar. Uma nova importação CSV também não apaga o agrupamento existente.

Para reverter a interface, basta reverter o código e gerar outro build. Não é necessário executar SQL. Agrupamentos permanecem no campo já existente e referências novas continuam sendo texto legível nas versões anteriores. A programação nunca é ativada por visitar a matriz.

## Resultados de validação

- 139 testes unitários aprovados, incluindo seis novos casos de datas, busca, compatibilidade de referências e bloqueio de URLs executáveis.
- TypeScript sem erros.
- ESLint sem erros; 13 avisos remanescentes, principalmente sobre efeitos de sincronização já presentes nos componentes.
- Build de produção aprovado com Prisma, TypeScript e geração das 47 páginas/rotas.
- Auditoria de produção aprovada: 14 telas × quatro larguras (320, 390, 820 e 1440 px), busca, navegação móvel, confirmação de descarte na matriz e referência Tec. O hash dos dados antes/depois permaneceu idêntico, incluindo estado do ciclo e revisões. O service worker é bloqueado somente nessa auditoria visual para evitar sua recarga automática de instalação.
- Fluxo de cronômetro aprovado com comandos de API simulados: iniciar, pausar, retomar, informar acertos/erros, concluir uma única vez, percorrer o diálogo por teclado, fechar com Escape e restaurar o foco. Nenhuma sessão real foi gravada.
- 12 testes de regressão de navegador aprovados: rota protegida, login offline e registro local, tema escuro/foco e manifesto/service worker, em desktop, tablet e celular.
- Validação integrada adicional aprovada em PostgreSQL 16 local, criado exclusivamente para dados fictícios: aplicação de todas as migrations em banco vazio, conclusão das 64 posições, posição 16 com pendências, troca das quatro voltas, finalizações simultâneas/repetidas, preservação do histórico, encerramento sem quinta volta automática e ampliação explícita para oito voltas mantendo as mesmas 16 posições.
- Teste de navegador da programação aprovado contra o build de produção usando esse banco isolado: ativação com confirmação, edição da matriz no celular, referência Tec, reposicionamento, conclusão idempotente, exportação/restauração do backup fictício e larguras de 320, 390, 820 e 1440 px. Os seletores antigos foram atualizados para os novos títulos e para distinguir o progresso da volta de sua visão geral.
- A revisão visual identificou contraste insuficiente no índigo usado como texto sobre superfícies escuras. Texto de destaque e fundo de ação agora usam tokens separados; botões com texto branco também receberam um pequeno ajuste de contraste. Há verificação de contraste mínimo de 4,5:1 no navegador para as principais ações do painel escuro.

Para repetir a auditoria com a conta configurada: `npm run test:modernization`. Ela lê o banco e não envia formulários; o teste do cronômetro intercepta os comandos e simula a API. Os arquivos de evidência ficam em `test-results/` e `artifacts/`, ignorados pelo Git. A suíte normal não executa essa auditoria específica sem a configuração dedicada.

## Pontos que ainda merecem atenção

- A validação isolada das quatro voltas foi concluída. As contas reais não foram usadas para concluir ou modificar ciclos. Para futuras regressões, `test:cycle-program` e `playwright.program.config.ts` continuam exigindo o banco local fictício `studyflow_program_test` e a opção explícita `PROGRAM_CYCLE_INTEGRATION=true`.
- O aviso de edições pendentes cobre links e recarga/fechamento; a navegação pelo botão Voltar do navegador dentro da aplicação ainda merece uma estratégia de rascunhos.
- O agrupamento de subassuntos é textual e opcional. Uma hierarquia relacional com nomes iguais em grupos distintos exigirá uma proposta de migração separada e reversível.
- A leitura das estatísticas e do histórico geral ainda carrega o histórico do guia. Contas muito grandes podem se beneficiar de agregação/paginação no servidor, com medição antes de mudar os contratos.
- Revisar as verificações antigas de fidelidade a protótipos antes de adotá-las como referência para a nova interface. Os testes funcionais e a auditoria responsiva são a referência desta modernização.
