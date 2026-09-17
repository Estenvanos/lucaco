# Lucaco — regras do projeto

Plataforma de chat e voz estilo Discord (amigos, DMs E2E, servers com papéis/permissões, canais de texto e **um único canal de voz por server** com compartilhamento de aba via SFU). Referência completa: `arquitetura-lucaco.md` — leia a seção relevante antes de implementar algo novo.

## Stack

- **Backend (`backend/`)**: TypeScript, Express 5, Zod, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL, MinIO/S3 (avatares e mídia).
- **Frontend (`frontend/`)**: Vite + TypeScript puro (teste de voz/aba), servido por nginx no Docker com proxy same-origin para a API (`/auth`, `/users`, `/socket.io`).
- **Tempo real**: Socket.IO no mesmo processo da API; módulo `voice` registra eventos em `voice.routes.ts` (`voice:join`, `voice:leave`, `voice:signal`) com resposta via ack `{...}` ou `{ error }`.
- **Planejado**: MongoDB (mensagens cifradas), Redis (presença, cache de permissões, filas BullMQ), mediasoup + coturn (serviço de mídia separado), frontend Vite + React.
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
```

Regras de módulo:
- Toda entrada externa é validada com **Zod** no `<modulo>.schema.ts`. Nada de validação manual espalhada.
- Controller não acessa Prisma; service não acessa `req`/`res`.
- Erros de negócio: `throw new HttpError(status, msg)` (`lib/http-error.ts`). `lib/error-handler.ts` (`toErrorResponse`) converte qualquer erro em status + body, usado pelo Express e pelos acks de socket. Logs sempre via `logger` (`lib/logger.ts`), nunca `console.*` direto.
- Um módulo usa outro **somente pelo service dele** (ex.: `auth` importa `users.services`). Nunca consultar tabelas de outro módulo direto (ex.: `messages` usa `channelsService.canView(...)`, não a tabela `channels`).
- Rotas de socket seguem a mesma estrutura: `<modulo>.routes.ts` registra eventos, controller valida com Zod e devolve o ack, service tem a lógica.
- Arquivo extra no módulo só quando for inevitável (ex.: `auth.middleware.ts`).
- Módulos previstos: `auth`, `users`, `images`, `friends`, `servers`, `roles`, `channels`, `messages`, `voice`, `media`, `jobs`.
- Imagens públicas (avatar, ícone de server) passam **sempre** pelo módulo `images`: upload com `imageUpload(field)`, validação `imageFileSchema`, `imagesService.store(file, folder, ownerId)` (sharp: resize, remove EXIF, converte para webp). Chave no storage: `images/<folder>/<ownerId>/<uuid>.webp`. Novo tipo de imagem = novo preset em `IMAGE_PRESETS`. Anexos E2E (cifrados no cliente) **não** passam pelo sharp — vão para o módulo `media`.

## Princípios de código

- **Mudança mínima**: o menor diff que resolve. Não refatorar o que não foi pedido. Sem abstrações especulativas (interface com uma implementação, factory, config para valor fixo).
- **Dependências mínimas**: antes de instalar pacote, usar stdlib do Node, recurso da plataforma ou dependência já instalada. Nova dependência só com justificativa clara.
- Reutilizar o que já existe em `lib/` e nos services antes de escrever algo novo.
- Atalhos deliberados levam comentário `// ponytail: <limite> — <como evoluir>`.
- ESM (`"type": "module"`): imports relativos com extensão `.js`.

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
cd backend && npx tsc --noEmit          # checagem de tipos
cd frontend && npm run dev              # front em :5173 com proxy para :3333
# stack Docker: front em http://localhost:8080
```
