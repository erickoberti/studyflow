# Ciclo inteligente

Cada posição contém uma disciplina. `CycleService.getCurrent` obtém a posição pelo cursor e seleciona um assunto ativo da disciplina usando o mesmo motor para dashboard, ciclo e estudo. A prévia usa estado virtual e nunca grava progresso.

Ao finalizar uma sessão de ciclo, o serviço atualiza os pesos, o `SubjectProgress` e o cursor em uma transação. No modo avulso apenas o progresso do assunto é atualizado; o cursor não muda.

## Simulação e diagnóstico

O motor `simulateWeightedCycle` é usado para a prévia avançada e para o diagnóstico. Ele opera sobre cópias dos pesos e não persiste cursor, progresso, sessão ou revisão. O painel em `/debug/ciclo` aceita 20, 100, 200 ou 500 sessões e apresenta frequência, distribuição, intervalos e o status PASS/FAIL do validador.

O endpoint `/api/cycle/export` exporta a mesma simulação em Excel, com as abas Sequência, Disciplinas, Assuntos e Resumo.
