# Funcionamento offline

O StudyFlow persiste sessões ativas e operações no IndexedDB `studyflow-active-sessions`. O snapshot básico de guias continua disponível para compatibilidade, mas novas sessões usam exclusivamente `ActiveStudySession` e a fila versionada.

São suportadas as operações `START_SESSION`, `PAUSE_SESSION`, `RESUME_SESSION`, `FINISH_SESSION`, `CANCEL_SESSION` e `CREATE_STANDALONE_SESSION`. Cada payload preserva usuário, guia, disciplina, assunto, posição, modo, timestamps, tempo acumulado, questões, dificuldade e observação. Estudo avulso sem `subjectId` é rejeitado.

O cronômetro é reconstruído usando `accumulatedSeconds`, `startedAt` e o último timestamp de retomada. O cursor não avança localmente: somente a finalização atômica confirmada pelo servidor altera ciclo, progresso, revisões e métricas.

Estudos avulsos offline mantêm o mesmo `operationId` nos retries e após reiniciar. A criação de `StudySession` e a confirmação no ledger agora ocorrem na mesma transação; uma resposta perdida pode ser repetida sem criar outro registro.

O lote estrutural responde por ID de operação. Apenas resultados `completed` ou `already_processed` da conta atual saem da fila; rejeições, falhas, dependências bloqueadas e respostas ausentes permanecem pendentes. Novos guias, disciplinas e assuntos usam seu ID local estável também no servidor, para reconhecer criações reenviadas. Operações estruturais antigas que já foram processadas pela versão anterior do servidor com outro ID ainda exigem conferência manual se a resposta original se perdeu.

Limitações: dados estruturais antigos permanecem em `localStorage` para compatibilidade; conflitos não são mesclados automaticamente; o usuário escolhe manter a versão confirmada no servidor e arquivar a pendência local.

Simulados e progresso do edital são recursos online na Fase 5. Eles não entram na fila de sessões ativas e, por segurança, suas APIs continuam `NetworkOnly` no PWA.

O bootstrap inclui `subjectId` em cada sessão e a descrição dos guias. O snapshot da conta preserva sessões locais pendentes durante a hidratação; uma resposta atrasada registra o ID do servidor, mas mantém `subjectId` e data editados localmente para o próximo envio. Snapshots antigos sem `subjectId` continuam legíveis: sessões de ciclo podem usar a posição histórica, enquanto registros avulsos sem assunto explícito ficam pendentes para evitar associá-los a um assunto diferente.
