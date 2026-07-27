# Simulados

A tela `/simulados` registra provas completas por guia. A distribuição sugerida usa a soma dos pesos dos assuntos ativos de cada disciplina e o método do maior resto, garantindo que a soma seja exatamente a quantidade planejada.

Questões e acertos são enviados por disciplina. O servidor valida propriedade do guia, duplicidade, números negativos e `acertos <= questões`; erros, total e percentual são derivados uma única vez. Cada resultado preserva o peso e o nome da disciplina usados naquele momento.

Simulados nunca criam `StudySession`, não atualizam progresso, não criam revisões e não alteram o cursor. O histórico exibe aproveitamento geral e detalhamento por disciplina.
