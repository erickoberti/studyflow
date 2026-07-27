# Funcionamento offline

O StudyFlow persiste sessões ativas e operações no IndexedDB `studyflow-active-sessions`. O snapshot básico de guias continua disponível para compatibilidade, mas novas sessões usam exclusivamente `ActiveStudySession` e a fila versionada.

São suportadas as operações `START_SESSION`, `PAUSE_SESSION`, `RESUME_SESSION`, `FINISH_SESSION`, `CANCEL_SESSION` e `CREATE_STANDALONE_SESSION`. Cada payload preserva usuário, guia, disciplina, assunto, posição, modo, timestamps, tempo acumulado, questões, dificuldade e observação. Estudo avulso sem `subjectId` é rejeitado.

O cronômetro é reconstruído usando `accumulatedSeconds`, `startedAt` e o último timestamp de retomada. O cursor não avança localmente: somente a finalização atômica confirmada pelo servidor altera ciclo, progresso, revisões e métricas.

Limitações: dados estruturais antigos permanecem em `localStorage` para compatibilidade; conflitos não são mesclados automaticamente; o usuário escolhe manter a versão confirmada no servidor e arquivar a pendência local.

Simulados e progresso do edital são recursos online na Fase 5. Eles não entram na fila de sessões ativas e, por segurança, suas APIs continuam `NetworkOnly` no PWA.
