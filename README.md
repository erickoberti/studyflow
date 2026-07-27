# StudyFlow

Plataforma responsiva de estudos por ciclos, com guias independentes, sessões ativas, Weighted Round Robin, revisões, análises, simulados, planejamento e funcionamento offline como PWA.

## Stack

- Next.js 14, React 18 e TypeScript
- Prisma e PostgreSQL
- NextAuth com credenciais
- Tailwind CSS e Recharts
- IndexedDB, service worker e `next-pwa`
- Node Test Runner e Playwright

## Arquitetura

- `CycleEntry.discipline` define a posição estática do ciclo.
- `CycleService` seleciona dinamicamente o assunto e controla a sessão ativa.
- `StudySession.subject` preserva o assunto efetivamente estudado.
- Sessões offline usam fila persistente e idempotente por `operationId`.
- Simulados permanecem separados das sessões comuns e do cursor.
- Todo dado funcional é isolado por usuário e guia.

Consulte [docs/architecture.md](docs/architecture.md), [docs/cycle.md](docs/cycle.md), [docs/offline.md](docs/offline.md) e [docs/stabilization.md](docs/stabilization.md).

## Desenvolvimento

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Variáveis obrigatórias: `DATABASE_URL`, `NEXTAUTH_URL` e `NEXTAUTH_SECRET`.

## Validação

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`npm test` executa testes unitários e E2E em Chrome nos perfis desktop, tablet e celular. Os cenários online são somente leitura; fluxos offline usam snapshot isolado no navegador.

## Deploy

Execute `npx prisma migrate deploy` antes da nova versão da aplicação. O service worker é regenerado pelo build e nunca armazena respostas autenticadas de API ou HTML privado.
