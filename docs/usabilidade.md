# Revisão de usabilidade do StudyFlow

## Diagnóstico e comparação

A revisão considerou ciclo, cadastro, painel, estudo, histórico, revisões e as consultas locais. A versão anterior a `ca4de75` apresentava os assuntos em linhas com identificação explícita da matéria. Essa associação era mais direta, embora a tabela antiga exigisse largura demais no celular.

Os principais obstáculos encontrados foram:

- O ciclo exibia só cinco posições, com navegação adicional para enxergar o conjunto e nomes truncados. Posições anteriores eram riscadas como concluídas mesmo quando o cursor havia sido movido manualmente.
- O cadastro paginava três grupos de disciplinas, com cabeçalhos grandes, cores por categoria e pouca informação visível sobre o conjunto.
- Três fontes, paletas específicas por tela e regras de CSS sobrepostas enfraqueciam a consistência. O bloco atual do ciclo reservava mais de 300 px mesmo com pouco conteúdo.
- A confirmação de exclusão dentro do menu de uma linha podia ficar atrás da navegação móvel.

## Ajustes implementados

- Sequência completa em lista numerada, sem paginação nem corte de nomes. Destaques textuais e visuais para a posição atual e a seguinte, inclusive na passagem de volta.
- Assuntos previstos pelo motor atual do ciclo, em lugar da relação histórica da posição. Indicação de que a seleção pode mudar após cada estudo; posições pausadas e indisponíveis continuam visíveis.
- Percurso da volta separado da meta semanal. A indicação de posições anteriores não afirma que houve estudos concluídos. Estatísticas acumuladas e ações de gerenciamento foram preservadas.
- Cadastro com linhas explícitas “Matéria → Assunto”, recuperação da associação da versão anterior, busca por nomes, notas e referência TEC, filtro de matéria e filtros de peso e acertos. Matérias sem assuntos continuam acessíveis.
- Inter para leitura e controles; Plus Jakarta Sans para títulos. Fundo claro neutro, superfícies brancas e índigo como cor principal; estados de atenção usam cor e texto. Cabeçalhos e espaços foram reduzidos.
- Painel mais compacto, link “Ver ciclo” identificado por texto, consulta local do ciclo sem tabela larga e confirmação de exclusão renderizada acima da navegação.

## Validação

`npx playwright test --config=playwright.ux.config.ts` verifica a lista inteira e sua ordem, ausência de cortes em 320, 390, 820, 1440 e 1920 px, filtros e recuperação de resultados, menus, cancelamento de exclusão, temas escuro e claro, formulários e acesso ao estudo. O teste usa leitura dos dados configurados; não envia formulários de alteração.

As capturas ficam em `test-results`. Não houve migração, mudança de algoritmo de seleção ou alteração dos cadastros e sessões do usuário.

Na preparação para produção, os diretórios locais e ignorados `artifacts` e `backups` foram excluídos da checagem TypeScript. O teste de troca de conta passou a declarar explicitamente o estado online, evitando que o `navigator` de versões recentes do Node interrompa o cenário antes da requisição simulada. Nenhuma regra de sincronização da aplicação foi alterada.

O typecheck padrão e o build otimizado de produção passaram. Os 128 testes unitários foram aprovados. Os dois testes de usabilidade também passaram contra o servidor de produção local, incluindo cinco larguras e o cenário offline de nomes longos. Os 12 testes de smoke de produção passaram em desktop, tablet e celular, cobrindo proteção de rotas, acesso offline, foco por teclado, tema, manifesto e service worker. O lint terminou sem erros e com 13 avisos preexistentes.
