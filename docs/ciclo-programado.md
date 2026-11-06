# Ciclo de 16 posições e quatro voltas

## Compatibilidade e ativação

A auditoria foi somente de leitura. O modelo anterior já tem posições estáveis (`CycleEntry`), cursor e volta (`StudyGuideCycleState`), sessões (`StudySession`), progresso por assunto (`SubjectProgress`) e revisões (`ReviewSchedule`). A seleção anterior é por pesos; passar da última posição não comprova a conclusão de todas as posições. Há histórico legado com `cycleRound` nulo, portanto esse campo não pode ser inferido a partir do cursor.

A migration `20261106120000_programmed_cycle` é aditiva e transacional. Cria `CycleProgram`, `CycleProgramItem` e `CycleProgramCompletion`, além de campos opcionais nas sessões. Não atualiza sessões existentes, não substitui posições e não ativa nenhum programa. As restrições e o trigger impedem acrescentar, remover, pausar ou reordenar as 16 posições de um guia programado.

A ativação ocorre somente em `/ciclo/configuracao`, após comparação e confirmação explícita. Um guia com 16 posições ativas e consecutivas reutiliza os mesmos IDs e mantém o cursor e a volta legada. Um guia vazio pode receber 16 posições mediante confirmação. Qualquer outra estrutura é recusada, sem transformação automática. Os outros guias permanecem no modo anterior.

A comparação identifica os IDs, ordem e estado do cursor. Se o ciclo mudar entre a comparação e a confirmação, a ativação é recusada até recarregar. As proteções de banco serializam inclusive uma requisição de cliente antigo com a ativação; um estudo pendente não é convertido silenciosamente em estudo de outro assunto.

As quatro voltas programadas têm numeração própria, começando em 1/4. O estado anterior é registrado em `initialPosition` e `initialRound`. A numeração legada não é reiniciada no banco. Se todas as 16 conclusões anteriores forem vinculadas explicitamente na ativação, a programação avança para a segunda volta. Nenhuma sessão histórica é criada, reatribuída ou recalculada para simular conclusão.

Matérias equivalentes já cadastradas são reaproveitadas, sem renomeá-las. Novos assuntos são criados apenas quando não existe o mesmo nome na matéria. Nomes e referências sugeridos do Tec não são classificados como oficiais; a confirmação é feita pelo usuário. Alterar a referência na matriz retira a confirmação até nova conferência.

## Progresso e histórico

Uma conclusão tem vínculo único com o item da programação e com a sessão que a comprova. A finalização da sessão usa o mecanismo de idempotência existente, transação e bloqueio por guia. Finalizações simultâneas ou repetidas não duplicam sessões ou conclusões.

Mover o cursor, revisar uma posição já concluída ou salvar sem avançar não conclui outras posições. Ao concluir a posição 16 com pendências, o cursor retorna a uma posição pendente da mesma volta. Só 16 conclusões distintas permitem avançar. A quarta volta encerra a programação, sem iniciar automaticamente uma quinta.

A matriz pode corrigir ou substituir assuntos, inclusive em posições já concluídas. Isso altera a programação, mas não o registro da sessão nem o fato de a posição ter sido concluída. A sessão programada guarda os nomes e as referências usados no estudo, além de posição, volta, assunto e resultados. Substituições passam a apontar para outro assunto, sem renomear o assunto histórico. A edição fica bloqueada enquanto existe sessão aberta.

Após o encerramento, o usuário pode registrar revisão geral pelos recursos existentes ou acrescentar mais quatro voltas a partir do modelo. A ampliação cria programação, não novas posições nem cópias de sessões.

Revisões programadas usam: abaixo de 60%, intervalos de 1, 7 e 30 dias; de 60% a menos de 80%, 7 e 30 dias; a partir de 80%, 30 dias. Estudos sem questões não recebem uma classificação artificial de 0% de acertos. Revisões não bloqueiam o avanço.

## Offline e backup

O snapshot offline identifica o item da programação e a volta atual. Uma sessão pendente baseada numa programação anterior fica em conflito para conferência; seus resultados não são atribuídos silenciosamente a outro item. As mudanças estruturais de guias programados são conferidas na matriz online. Os demais guias mantêm o fluxo anterior.

O backup funcional inclui programação e conclusões. Backups anteriores sem os novos modelos e campos opcionais continuam aceitos; os novos campos são tratados como nulos e a programação ausente como vazia. Não se deve importar dados de outra conta.

## Validação e publicação

Os testes integrados usam exclusivamente PostgreSQL local com dados fictícios. Cobrem preservação dos IDs, cursor e sessões legadas, aproveitamento explícito, quatro voltas completas, posição 16 com pendências, concorrência, repetição, substituição de assunto, referências Tec, revisões e ampliação para oito voltas. Os testes de navegador cobrem a confirmação, matriz, edição e larguras de desktop e celular.

Resultado final: 133 testes unitários aprovados; teste integrado PostgreSQL aprovado; teste de navegador aprovado contra o build otimizado, incluindo exportação e restauração do backup da conta fictícia; 12 testes de smoke aprovados. O build e a checagem TypeScript passaram. O lint terminou com zero erros e 13 avisos preexistentes. A migration completa foi validada também partindo de um banco local vazio. Não foram copiados dados reais para esses testes.

Antes de atualizar um banco existente, siga `docs/migrations.md`: backup PostgreSQL completo e restauração verificada, auditoria do schema e do ledger. A instalação existente pode ter diferenças no ledger; não execute todas as migrations pendentes nem registre baselines por suposição. A conversão de cada guia é uma ação separada da instalação do schema e continua exigindo a confirmação da matriz.

Nesta implementação, a exportação do backup completo do banco configurado foi bloqueada pela revisão automática por falta de autorização específica para copiar dados de todas as contas para um arquivo local. Não foi contornado esse bloqueio. A migration foi executada somente em bancos locais vazios, e a publicação com o novo schema fica pendente da autorização e da verificação de restauração.
