# Baseline e atualização do PostgreSQL

O projeto usa Prisma Migrate. A migration `20260723000000_baseline` cria o schema que existia imediatamente antes de `20260724090000_phase1_active_study_session`. As migrations posteriores permanecem intactas e devem ser executadas na ordem registrada pelo Prisma em `_prisma_migrations`.

Antes de qualquer atualização de uma instalação existente, faça backup da base inteira e confira que ele pode ser restaurado. O backup JSON de `/api/backup` cobre dados funcionais de uma conta, mas **não** substitui um dump PostgreSQL para recuperar estrutura, usuários, autenticação e histórico das migrations.

## Instalação nova

Use um schema PostgreSQL vazio e execute `npx prisma migrate deploy`. A baseline cria as tabelas iniciais; as migrations incrementais levam a base até o schema atual. Execute `npx prisma migrate status` depois. Não rode `prisma db push` sobre esta instalação.

## Instalação existente

Verifique as tabelas e `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at` (se o ledger existir). Se as migrations antigas já estão registradas como aplicadas, confira o schema e marque **somente** a baseline como aplicada com `npx prisma migrate resolve --applied 20260723000000_baseline`; depois rode `npx prisma migrate deploy` e `npx prisma migrate status`.

Se a base foi criada por `prisma db push` e não há ledger, compare o schema e os dados com cada migration antes de marcar qualquer uma como aplicada. `migrate resolve --applied` registra a migration sem executar seu SQL, inclusive eventuais backfills; use apenas quando seus efeitos já estiverem presentes. Migrações faltantes devem ser aplicadas na ordem. Bases parcialmente atualizadas ou com migration falha exigem diagnóstico e recuperação manual antes do deploy. Nunca marque uma migration como aplicada apenas para eliminar um erro.

A baseline aborta antes de criar objetos quando encontra tabelas existentes no schema. Esse bloqueio impede que um `migrate deploy` novo tente recriar tabelas em uma instalação antiga. Se ela tiver sido tentada por engano e constar como falha, verifique a ausência de mudanças parciais, faça `npx prisma migrate resolve --rolled-back 20260723000000_baseline` e então siga a análise acima. A baseline envolve suas DDLs em uma transação; rodá-la novamente após registro bem-sucedido é impedido pelo ledger do Prisma.

Uma instalação antiga já atualizada, uma parcialmente atualizada e uma nova não são intercambiáveis. Consulte o ledger, compare o schema real com `prisma/schema.prisma` e só então escolha entre `migrate deploy`, `migrate resolve` ou recuperação do dump. Não use `migrate reset` em bases com dados.
