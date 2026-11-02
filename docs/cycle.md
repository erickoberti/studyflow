# Ciclo inteligente

Cada posição contém uma disciplina. `CycleService.getCurrent` obtém a posição pelo cursor e seleciona um assunto ativo da disciplina usando o mesmo motor para dashboard, ciclo e estudo. A prévia usa estado virtual e nunca grava progresso.

Ao finalizar uma sessão de ciclo, o serviço atualiza os pesos, o `SubjectProgress` e o cursor em uma transação. No modo avulso apenas o progresso do assunto é atualizado; o cursor não muda.

## Configuração de um guia novo

Cadastrar uma matéria ativa cria, na mesma transação, o assunto visível e editável `Estudo geral` e uma posição no final do ciclo. Detalhar os assuntos é opcional. Se a matéria já tem assuntos ou posições, eles são reutilizados; pausas existentes são preservadas. O cadastro offline cria os mesmos registros localmente, com IDs estáveis que o servidor reutiliza na sincronização.

Guias antigos com ciclo vazio oferecem `Montar ciclo com minhas matérias`, com uma prévia das disciplinas ativas. A ação cria somente o necessário e não altera ciclos existentes, cursor, histórico ou progresso. Disciplinas inativas ficam de fora. Um bloqueio por guia serializa as criações concorrentes para evitar posições duplicadas.

No cadastro manual de assuntos, a ordem é opcional: o motor já considera os assuntos ativos da matéria na posição existente. Uma ordem positiva acrescenta ou move uma posição explícita; deixar o campo vazio preserva a sequência da matéria. A importação da planilha-base continua criando disciplinas, assuntos e posições conforme o arquivo. Disciplinas inativas precisam ser reativadas para participar dos estudos.

Criar ou selecionar um guia invalida o layout e as páginas para atualizar a identificação do guia e os dados nas próximas navegações. O editor de guias reinicia quando muda o guia ativo.

O status da matéria aparece separado dos comandos `Pausar` e `Ativar`. Esses comandos enviam o estado desejado, portanto repetir o mesmo envio não inverte o status. Ao ativar uma matéria antiga sem assuntos ou posição, o cadastro inicial é completado na mesma transação. Histórico, cursor e pausas explícitas de assuntos ou posições são preservados.

## Simulação e diagnóstico

O motor `simulateWeightedCycle` é usado para a prévia avançada e para o diagnóstico. Ele opera sobre cópias dos pesos e não persiste cursor, progresso, sessão ou revisão. O painel em `/debug/ciclo` aceita 20, 100, 200 ou 500 sessões e apresenta frequência, distribuição, intervalos e o status PASS/FAIL do validador.

O endpoint `/api/cycle/export` exporta a mesma simulação em Excel, com as abas Sequência, Disciplinas, Assuntos e Resumo.
