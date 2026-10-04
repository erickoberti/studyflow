# Backup e restauração

`GET /api/backup` exporta um JSON versionado da conta autenticada. O arquivo contém guias, disciplinas, assuntos, ciclos, sessões e seu histórico, configurações, revisões, progresso, simulados e metas manuais. IDs e datas são preservados. Totais calculados a partir desses registros são reconstruídos pela aplicação.

O arquivo **não** contém senha, tokens de recuperação, cookies, sessão de autenticação, o ledger de sincronização ou o cache/fila offline local do navegador. Guarde-o em local privado; ele ainda contém dados pessoais de estudo.

`POST /api/backup` recebe o mesmo JSON com a propriedade adicional `"mode": "replace"` no nível superior. A importação exige a mesma conta (`accountId`), formato e versão 1; arquivos antigos, incompletos ou com referências inválidas são recusados. Ela **substitui** todos os dados funcionais dessa conta em uma transação PostgreSQL; não mescla. Em caso de falha, a transação reverte integralmente. Os dados de outras contas não são alterados. O limite é 10 MB.

Antes de restaurar, sincronize as operações offline em todos os dispositivos e mantenha uma cópia do estado atual. A API impede a restauração se o ledger do servidor ainda tiver operações pendentes ou em conflito; ela não consegue inspecionar filas IndexedDB de outros navegadores. Após restaurar, limpe o cache e a fila offline antigos do navegador antes de voltar a sincronizar, para que comandos obsoletos não sejam reenviados. A restauração remove entradas concluídas do ledger para não manter respostas ligadas ao estado substituído.

Um operador pode baixar o arquivo estando autenticado e enviar o JSON editado apenas para acrescentar `mode`. Não importe arquivo de outra conta. Teste a recuperação em uma base descartável antes de depender dela em produção.
