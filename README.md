# Tic-Tac-Toe · TIM Arcade

Jogo da velha online multiplayer em tempo real, com visual retrô pixel art (anos 90).

- **Stack**: Vite + React + TS + Tailwind (web) · Fastify + Socket.IO + ioredis (server) · Redis (estado) · JWT (auth de sala)
- **Deploy**: Vercel (web) · Fly.io `gru` (server) · Upstash Redis
- **Custo**: 100% gratuito (free tier de todas as plataformas)
- **Sem cadastro**: salas anônimas por código de 6 caracteres
- **Região-alvo**: Brasil centro-oeste (Brasília / Goiânia / Cuiabá)

## Arquitetura

```
┌──────────────┐       WebSocket         ┌──────────────────┐
│   Vercel     │ ◄──────────────────────► │   Fly.io (gru)   │
│  React SPA   │                          │   Fastify +      │
│              │       HTTP REST          │   Socket.IO      │
│              │ ◄──────────────────────► │                  │
└──────────────┘                          └────────┬─────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │  Upstash Redis   │
                                          │  estado de salas │
                                          └──────────────────┘
```

- **Servidor é autoridade**: valida toda jogada, gerencia turnos, detecta vitória/empate.
- **Cliente é terminal burro bonito**: renderiza o estado, envia intenção.
- **Idempotência**: cada jogada tem `id` único; servidor deduplica em janela de 1h.
- **Sala efêmera**: expira 1h após criação, 24h após última jogada.

## Estrutura

```
.
├── apps/
│   ├── web/           # React + Vite + Tailwind
│   └── server/        # Fastify + Socket.IO + ioredis
├── packages/
│   └── shared/        # engine isomórfica + protocolo WS
├── scripts/
│   └── dev.mjs        # orchestrator (redis + web + server)
├── docker-compose.yml
├── fly.toml
├── vercel.json
└── README.md
```

## Desenvolvimento local

### Pré-requisitos
- Node ≥ 20
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker (para subir Redis)

### Setup
```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
```

### Subir tudo (Redis + web + server)
```bash
pnpm dev
```

- Redis: `localhost:6379`
- API: `http://localhost:3001`
- Web: `http://localhost:5173`

### Subir Redis sozinho
```bash
pnpm redis:up
pnpm redis:down
```

### Testes
```bash
pnpm test           # roda shared + server + web
pnpm test --watch   # watch mode
```

### Typecheck
```bash
pnpm typecheck
```

### E2E WS smoke test
Com API rodando em `localhost:3001`:
```bash
cd apps/server && node scripts/e2e-room.mjs
```

## Deploy

### 1. Upstash Redis (free tier)

1. Crie conta em [upstash.com](https://upstash.com) (Google sign-in).
2. **Create Database** → região mais próxima de `gru` (ex: `us-east-1` é o default; prefira `sa-east-1` se disponível).
3. Copie a **Redis URL** (formato `rediss://default:<senha>@<host>:<port>`).
4. Anote — vai usar no Fly.

### 2. Fly.io (server) · região `gru`

```bash
# instalar CLI
curl -L https://fly.io/install.sh | sh

# login
fly auth signup  # ou fly auth login

# primeiro deploy (cria o app)
cd /caminho/do/repo
fly launch --no-deploy --copy-config  # detecta Dockerfile em apps/server
# IMPORTANTE: quando perguntar o nome, use: tic-tac-toe-tim-online
# IMPORTANTE: região primária: gru

# secrets
fly secrets set \
  REDIS_URL='rediss://default:...' \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGIN='https://tic-tac-toe-tim-online.vercel.app'

# deploy
fly deploy
```

Saída: `https://tic-tac-toe-tim-online.fly.dev`

**Validar**:
```bash
curl https://tic-tac-toe-tim-online.fly.dev/health
# esperado: {"ok":true,"redis":"up"}
```

### 3. Vercel (web)

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Framework Preset: **Vite** (auto-detectado).
3. **Environment Variables** (Production):
   - `VITE_API_URL` = `https://tic-tac-toe-tim-online.fly.dev`
4. Deploy.

Saída: `https://tic-tac-toe-tim-online.vercel.app`

**Voltar no Fly** e adicionar a URL da Vercel no CORS:
```bash
fly secrets set CORS_ORIGIN='https://tic-tac-toe-tim-online.vercel.app,https://tic-tac-toe-tim-online-*.vercel.app'
# (Vercel gera subdomínios por branch — o curinga * cobre previews)
```

### 4. Smoke test em produção

1. Abra `https://tic-tac-toe-tim-online.vercel.app/` em 2 abas/celulares diferentes.
2. Aba 1: clique **PRESS START** → copia o código de 6 caracteres.
3. Aba 2: cole o código em **INSERT COIN** → entra.
4. Jogue — ambos veem o tabuleiro atualizar em tempo real.

## Protocolo WebSocket

Mensagens cliente → servidor (evento `move`):
```json
{ "pos": 0, "id": "1700000000000-1-abc123" }
```

Mensagens servidor → cliente (evento `state`):
```json
{
  "code": "ABC234",
  "state": { "board": ["X",null,...], "turn": "O", "status": "playing", "winner": null, "line": null, "moveCount": 1 },
  "youAre": "X",
  "names": { "X": "ALICE" },
  "version": 1
}
```

Eventos: `state`, `connect`, `disconnect`, `reconnect_attempt`, `error`, `move`, `restart`.

## Limites do MVP

- Sem cadastro, sem ranking, sem histórico entre sessões
- Sem spectator (só 2 jogadores por sala)
- Sem chat
- Sem mobile app nativo (mas o web é responsivo)
- Sem TURN/STUN (WebRTC) — não é necessário, é WebSocket puro

## Próximos passos (pós-MVP)

- [ ] Placar cumulativo (X wins / O wins / draws) persistido em Redis
- [ ] Modo "melhor de N" (3 ou 5 partidas)
- [ ] Convite por link (`/r/CODE` mostra botão "convidar amigo")
- [ ] PWA (instalar como app no celular)
- [ ] Bots para jogar sozinho (minimax)

## Licença

MIT
