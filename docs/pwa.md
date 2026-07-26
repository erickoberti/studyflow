# PWA

O manifesto usa o nome StudyFlow, escopo `/`, início em `/dashboard`, orientação livre e `display: standalone`. Os ícones PNG de 192 e 512 pixels reutilizam o logo oficial; o ícone de 512 também é declarado como `maskable`.

O service worker é produzido por `next-pwa`. A cada foco, reconexão e intervalo de uma hora o navegador procura atualização. `skipWaiting`, `clientsClaim` e limpeza de caches antigos fazem a nova versão assumir o controle; a página recarrega uma vez quando o controlador muda.

## Cache seguro

- `/api/*` e `/_next/data/*`: `NetworkOnly`.
- páginas autenticadas: `NetworkOnly`, com fallback para o shell offline.
- `/offline/*` e `/auth/*`: `NetworkFirst`, pois não contêm respostas autenticadas com dados pessoais.
- chunks, fontes e imagens públicas: `CacheFirst` com expiração e limites.

Respostas de APIs, dados do Next e HTML autenticado nunca são gravados no runtime cache. Dados do usuário ficam isolados no IndexedDB por `userId` e `studyGuideId`.

## Instalação

Em navegadores compatíveis, “Instalar StudyFlow” aparece no painel de conexão. A instalação exige HTTPS (localhost é aceito em desenvolvimento), manifesto válido, service worker ativo e ícones acessíveis. No iOS, use “Adicionar à Tela de Início”.
