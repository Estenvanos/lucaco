# Lucaco — regras do projeto

Plataforma de chat e voz estilo Discord (amigos, DMs E2E, servers com papéis/permissões, canais de texto e **um único canal de voz por server** com compartilhamento de aba via SFU). Referência completa: `arquitetura-lucaco.md` — leia a seção relevante antes de implementar algo novo.

## Stack

- **Backend (`backend/`)**: TypeScript, Express 5, Zod, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL, MinIO/S3 (avatares e mídia).
- **Frontend (`frontend/`)**: Vite + React + TypeScript, TanStack Query (todo estado de servidor), React Router, Zod (formulários), servido por nginx no Docker com proxy same-origin para a API (`/auth`, `/users`, `/socket.io`). O `src/call.ts` atual é o teste de voz/aba em TS puro e vai virar módulo `voice` do novo frontend.
- **Tempo real**: Socket.IO no mesmo processo da API; módulo `voice` registra eventos em `voice.routes.ts` (`voice:join`, `voice:leave`, `voice:signal`) com resposta via ack `{...}` ou `{ error }`.
- **Planejado**: MongoDB (mensagens cifradas), Redis (presença, cache de permissões, filas BullMQ), mediasoup + coturn (serviço de mídia separado).
- **Infra local**: `docker-compose.yml` na raiz (postgres, minio, api, web).

## Arquitetura: monolito modular

O backend é **um único processo** dividido em módulos. Só a mídia (SFU) vira serviço separado. Não criar microsserviços.

Estrutura obrigatória:

```
backend/src/
  server.ts                 monta o app, registra os routers, error handler
  env.ts                    variáveis de ambiente validadas com Zod
  lib/                      infraestrutura compartilhada (prisma, storage, http-error, error-handler, logger)
  modules/
    <modulo>/
      <modulo>.routes.ts      só define rotas e middlewares -> chama o controller
      <modulo>.controller.ts  lê req (body, params, cookies, file), valida com o schema, chama o service, escreve res
      <modulo>.services.ts    regra de negócio e acesso ao banco; não conhece Express (sem req/res)
      <modulo>.schema.ts      schemas Zod de entrada + tipos via z.infer
      <modulo>.services.test.ts  testes unitários do service (Jest), obrigatório
```

Regras de módulo:
- Toda entrada externa é validada com **Zod** no `<modulo>.schema.ts`. Nada de validação manual espalhada.
- Controller não acessa Prisma; service não acessa `req`/`res`.
- Erros de negócio: `throw new HttpError(status, msg)` (`lib/http-error.ts`). `lib/error-handler.ts` (`toErrorResponse`) converte qualquer erro em status + body, usado pelo Express e pelos acks de socket. Logs sempre via `logger` (`lib/logger.ts`), nunca `console.*` direto.
- Um módulo usa outro **somente pelo service dele** (ex.: `auth` importa `users.services`). Nunca consultar tabelas de outro módulo direto (ex.: `messages` usa `channelsService.canView(...)`, não a tabela `channels`).
- Rotas de socket seguem a mesma estrutura: `<modulo>.routes.ts` registra eventos, controller valida com Zod e devolve o ack, service tem a lógica.
- Arquivo extra no módulo só quando for inevitável (ex.: `auth.middleware.ts`).
- Constantes compartilhadas entre módulos ficam em `lib/constants.ts` (nomes de eventos de socket, nome/path do cookie de refresh, limite de payload). Constante usada por **um** módulo só continua no módulo (ex.: `IMAGE_PRESETS`, `IMAGE_MAX_BYTES` no `images.schema.ts`). Valor que muda por ambiente é `env.ts`, não constante.
- Módulos previstos: `auth`, `users`, `images`, `friends`, `servers`, `roles`, `channels`, `messages`, `voice`, `media`, `jobs`.
- Imagens públicas (avatar, ícone de server) passam **sempre** pelo módulo `images`: upload com `imageUpload(field)`, validação `imageFileSchema`, `imagesService.store(file, folder, ownerId)` (sharp: resize, remove EXIF, converte para webp). Chave no storage: `images/<folder>/<ownerId>/<uuid>.webp`. Novo tipo de imagem = novo preset em `IMAGE_PRESETS`. Anexos E2E (cifrados no cliente) **não** passam pelo sharp — vão para o módulo `media`.

## Testes (obrigatório)

Runner: **Jest** (ESM + ts-jest), configurado em `backend/jest.config.ts`. Rodar com `cd backend && npm test`.

- **Módulo novo = arquivo de teste novo.** Todo módulo criado em `backend/src/modules/` entra com `<modulo>.services.test.ts` no mesmo commit. Módulo sem teste é trabalho incompleto.
- **Módulo alterado = teste atualizado no mesmo commit.** Mudou regra de negócio, status de erro ou formato de retorno: o teste muda junto. Teste que deixou de refletir o service é pior que teste nenhum.
- **Unitário com Prisma mockado**, não integração. Padrão (ESM exige mock antes do import):

```ts
import { jest } from "@jest/globals";
const friendship = { findUnique: jest.fn(), create: jest.fn() };
jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { friendship } }));
const friends = await import("./friends.services.js");
```

- **Mockar só a fronteira**: `lib/prisma.js`, `lib/storage.js` e services de outros módulos. Nunca mockar o service que está sendo testado.
- **O que todo service testa**: caminho feliz, erro de permissão/autorização (o status importa: 401, 403, 404, 409) e cada `HttpError` que o service lança.
- Teste cobre **comportamento observável** (retorno, status, o que foi gravado), não implementação interna.
- Regra de segurança tem teste que falha se a proteção cair (ex.: reuso de refresh revoga sessões; ninguém concede permissão que não tem; hash nunca sai no JSON).
- Nome do teste descreve a regra, não a função: `it("lets only the invited side accept")`.
- Sem teste de controller/rota por padrão — a lógica mora no service. Rota com lógica própria é sinal de que ela devia estar no service.
- Antes de dizer que algo está pronto: `npm test` e `npx tsc --noEmit`, os dois limpos.

## Princípios de código

- **Mudança mínima**: o menor diff que resolve. Não refatorar o que não foi pedido. Sem abstrações especulativas (interface com uma implementação, factory, config para valor fixo).
- **Dependências mínimas**: antes de instalar pacote, usar stdlib do Node, recurso da plataforma ou dependência já instalada. Nova dependência só com justificativa clara.
- Reutilizar o que já existe em `lib/` e nos services antes de escrever algo novo.
- Atalhos deliberados levam comentário `// ponytail: <limite> — <como evoluir>`.
- ESM (`"type": "module"`): imports relativos com extensão `.js`.

## Frontend (`frontend/`)

Referência completa: `arquitetura-lucaco.md` seção 4.1.

Estrutura obrigatória:

```
frontend/src/
  main.tsx                  monta React, QueryClientProvider, AuthProvider, RouterProvider
  routes.tsx                árvore de rotas (layouts + pages)
  lib/
    api.ts                  httpClient (fetch + baseURL + Bearer + refresh no 401)
    query-client.ts         QueryClient e defaults
    utils.ts                funções utilitárias puras (formatar data, cn, etc.)
  constants/
    routes.ts               paths das rotas do app (ROUTES.signIn, ...)
    endpoints.ts            paths da API (ENDPOINTS.auth.signIn, ...)
    socket-events.ts        nomes dos eventos de socket
    limits.ts               limites espelhados do backend (tamanho de imagem, tamanho de senha)
  services/
    <modulo>/
      <modulo>.keys.ts      query keys do módulo
      <modulo>.api.ts       chamadas HTTP + hooks useQuery/useMutation do módulo
  contexts/<modulo>.context.ts   createContext do módulo (só o contexto, sem JSX nem lógica)
  providers/<Modulo>Provider.tsx provider que preenche o contexto (ex.: AuthProvider)
  hooks/                    estado de página/UI (use<Pagina>.ts, use<Coisa>.ts) e hook de acesso ao contexto (useAuth)
  pages/<modulo>/<Nome>Page.tsx
  layouts/
    RootLayout.tsx          app logado: exige usuário (useAuth), senão redireciona para sign-in
    AuthLayout.tsx          telas públicas de auth (não exige usuário)
  components/
    shared/                 componentes reutilizados por mais de uma feature (Button, Modal, Avatar)
    <feature>/              componentes daquela feature
  schemas/<modulo>.schema.ts   schemas Zod dos formulários
  types/<modulo>.types.ts      tipos e interfaces
```

Regras:

- **Contexto só para estado de app que muitos componentes leem** (ex.: sessão). `contexts/` guarda o `createContext`, `providers/` o componente que o preenche, e o consumo é sempre pelo hook (`useAuth()`), nunca `use(AuthContext)` direto. Dado de servidor dentro do provider continua vindo do TanStack Query — contexto não é store paralela.
- **Sessão = `useAuth()`**: `{ user, isAuthenticated, isLoading }`. Guarda de rota logada fica no `RootLayout`.
- **Proibido `useEffect`.** Sem exceção discutível: estado derivado se calcula no render; reação a interação vai no handler; dado de servidor vai em TanStack Query; reset de estado vai por `key`; acesso a DOM vai por ref callback; assinatura externa (socket, media stream, storage) vai por `useSyncExternalStore` ou por wrapper em `services/`. Se parecer que só `useEffect` resolve, pare e pergunte.
- **Nenhuma god page.** Page só compõe: chama hooks e renderiza componentes. Lógica de estado sai para `hooks/`, acesso a API sai para `services/`. Page passando de ~120 linhas é sinal de que falta componente.
- **Nenhum `interface`/`type` declarado em page ou componente.** Todo tipo mora em `types/<modulo>.types.ts` (inclusive props: `type ButtonProps` fica em `types/ui.types.ts`).
- **Nenhum `fetch` fora de `lib/api.ts` e `services/`.** Componente nunca chama API direto.
- **Query keys só em `<modulo>.keys.ts`**, como factory (`friendsKeys.list()`, `friendsKeys.detail(id)`), usada tanto no hook quanto no `invalidateQueries`.
- **Formulário = schema Zod em `schemas/`**, nunca validação manual espalhada. Mesmo espírito do backend; o backend revalida sempre, o schema do front é UX.
- **Nenhuma string de rota ou endpoint literal no código**: use `constants/routes.ts` e `constants/endpoints.ts`.
- `components/shared/` é só para o que **já** é usado por duas features. Componente de uma feature só fica na pasta da feature.
- Access token vive em memória (módulo `lib/api.ts`), nunca em `localStorage`. Refresh é o cookie httpOnly em `/auth` — o front só chama `POST /auth/refresh`.
- Mudança mínima e dependências mínimas valem igual ao backend: antes de instalar lib de form/estado/UI, verificar se TanStack Query + React + plataforma já resolvem.

## Voz (estado atual)

- Hoje: **WebRTC P2P mesh** (1 RTCPeerConnection por par, perfect negotiation), só STUN, sala = string livre, sem checagem de permissão. É fase de teste.
- Compartilhamento: `getDisplayMedia` restrito a **aba + áudio da aba** (valida `displaySurface === "browser"`), adicionado na mesma conexão por renegociação.
- Próximos passos (não pular): permissão CONNECT/STREAM via servers/roles, coturn, Redis adapter se houver >1 instância, mediasoup substituindo o mesh.

## Segurança (não simplificar)

- Senhas com argon2id.
- Access token JWT ~15 min (header `Authorization: Bearer`); refresh token opaco rotativo em cookie httpOnly (`path=/auth`), **só o hash sha256** no banco (`sessions`). Reuso de refresh revogado derruba todas as sessões do usuário.
- Autorização sempre na API, nunca no SFU. O SFU só valida token efêmero assinado pela API.
- Mensagens são ciphertext opaco (E2E no cliente); o servidor nunca decifra.
- helmet, CORS restrito (`CORS_ORIGIN`), limites de payload/upload.

## Banco (Prisma)

- Schema em `backend/prisma/schema.prisma`, seguindo o modelo SQL de `arquitetura-lucaco.md` (UUID `gen_random_uuid()`, `snake_case` via `@map`, `timestamptz`).
- Mudou schema: `npm run db:migrate -- --name <nome>` (gera migration). Nunca editar migration já aplicada.
- Client gerado em `src/generated/prisma` (não versionado; `npm install` / `npm run build` regeneram).

## Comandos

```
npm run setup                           # instala raiz, backend e frontend
npm run services                        # sobe postgres + minio e aplica migrations (Docker ligado)
npm run dev                             # backend (:3333) + frontend (:5173) juntos
docker compose up -d --build            # stack completa (migrations rodam no boot da api)
docker compose up -d postgres minio     # só infra, para dev local
cd backend && npm run dev               # API em watch (porta 3333)
cd backend && npm test                  # testes unitários (Jest)
cd backend && npm run test:watch        # testes em watch
cd backend && npx tsc --noEmit          # checagem de tipos
cd frontend && npm run dev              # front em :5173 com proxy para :3333
# stack Docker: front em http://localhost:8080
```
