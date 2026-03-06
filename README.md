# StudyFlow Concurso (PWA)

Sistema completo para gestão de estudos por ciclo para concursos, com foco em resolução de questões.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL
- NextAuth (credentials)
- Recharts (gráficos)
- PWA (manifest + service worker via `next-pwa`)

## Funcionalidades entregues

- Cadastro/login com sessão persistente
- Recuperação de senha por token local
- Cadastro-base de disciplinas e assuntos
- Ciclo de estudos com:
  - ordem sequencial persistente
  - repetição de assuntos por entradas distintas (`cycleEntryId`)
  - duplicar / mover (setas) / ativar / inativar / excluir
- Registro diário de questões com cálculo automático:
  - `questões = acertos + erros`
  - `percentual = acertos / questões`
  - disciplina e peso automáticos via assunto do ciclo
- Sugestão confiável do próximo assunto:
  - usa última sessão + `orderIndex`
  - respeita repetição sem confundir nomes iguais
- Dashboard e estatísticas:
  - totais, evolução diária/semanal
  - desempenho por disciplina e assunto
  - fortes x fracos
  - classificação por faixa (urgente/atenção/bom/forte)
- Revisão e memória:
  - recentes
  - sem revisão
  - maiores erros
- Configurações:
  - metas e viés de prioridade por peso
- Bônus:
  - export CSV
  - backup JSON
  - importação base CSV
  - toasts de feedback

## Estrutura principal

- `prisma/schema.prisma`: modelagem de dados
- `prisma/seed.ts`: dados iniciais (inclui ciclo solicitado)
- `src/lib/auth.ts`: autenticação
- `src/lib/analytics.ts`: métricas, prioridade, próximo assunto
- `src/app/(app)/*`: telas protegidas
- `src/app/(auth)/*`: login/cadastro/recuperação
- `src/app/api/*`: rotas para registro, export/import, backup

## Modelagem resumida

- `User`
- `Discipline`
- `Subject`
- `CycleEntry` (ordem do ciclo; permite repetição)
- `StudySession`
- `UserSettings`
- `PasswordResetToken`

## Setup local

1. Instalar dependências:

```bash
npm install
```

2. Criar `.env` com base no exemplo:

```bash
cp .env.example .env
```

3. Rodar migração e gerar cliente Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Popular com dados demo:

```bash
npm run prisma:seed
```

5. Subir aplicação:

```bash
npm run dev
```

## Login demo

- Email: `demo@studyflow.com`
- Senha: `123456`

## Deploy recomendado

- Frontend/API: Vercel
- Banco Postgres: Neon, Supabase ou Railway
- Variáveis obrigatórias:
  - `DATABASE_URL`
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`

## Observação de PWA

- Em produção, `next-pwa` gera service worker automaticamente.
- Instalação no iPad/iPhone: Safari > Compartilhar > Adicionar à Tela de Início.
