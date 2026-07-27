# Roadmap

As Fases 1 e 2 consolidaram sessão, revisões, metas e desempenho. A Fase 3 adicionou simulação, diagnóstico, exportação e análises usando o mesmo motor do ciclo.

A Fase 4 consolidou `ActiveStudySession` offline, fila IndexedDB idempotente, conflitos preservados, reconexão automática e PWA com cache seguro.

A Fase 5 está concluída. Simulados são persistidos em domínio próprio, com distribuição proporcional por peso e histórico sem efeitos no ciclo. O planejamento combina data da prova, metas e cobertura do edital; recomendações determinísticas explicam peso, domínio, tempo sem estudo e status de cada assunto.

Fases futuras permanecem fora do escopo desta entrega.

## Estabilização pós-Fase 5

A estabilização funcional e visual das Fases 1 a 5 foi concluída sem adicionar novos domínios. A cobertura passa a incluir testes E2E dos fluxos críticos em desktop, tablet e celular, estados globais de carregamento e erro, acessibilidade, observabilidade sanitizada e validação do PWA/offline. O relatório técnico está em `docs/stabilization.md`.
