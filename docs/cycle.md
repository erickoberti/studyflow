# Ciclo inteligente

Cada posição contém uma disciplina. `CycleService.getCurrent` obtém a posição pelo cursor e seleciona um assunto ativo da disciplina usando o mesmo motor para dashboard, ciclo e estudo. A prévia usa estado virtual e nunca grava progresso.

Ao finalizar uma sessão de ciclo, o serviço atualiza os pesos, o `SubjectProgress` e o cursor em uma transação. No modo avulso apenas o progresso do assunto é atualizado; o cursor não muda.
