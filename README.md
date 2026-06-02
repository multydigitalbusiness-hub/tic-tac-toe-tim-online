# Tic-Tac-Toe Tim Online

Jogo da Velha multiplayer em tempo real, com visual retrô pixel art (estilo fliperama anos 90). Dois jogadores em cidades (ou dispositivos) diferentes se conectam por um código de 6 caracteres.

## Status

**Em construção** — Etapa 1 de 7: esqueleto do projeto e ambiente de dev.

## Stack

| Camada | Tecnologia | Hospedagem (produção) |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind | Vercel (free) |
| Backend | Node.js + Fastify + Socket.IO | Fly.io (`gru`, free) |
| Estado | Redis | Upstash (free) |
| Banco | _nenhum no MVP_ (Redis TTL 24h) | — |

## Pré-requisitos

- **Node.js 20+** (recomenda-se [nvm](https://github.com/nvm-sh/nvm))
- **pnpm 9+** (`npm install -g pnpm` ou via [get.pnpm.io](https://get.pnpm.io))
- **Docker** (para o Redis local)
- **Git**

> O Fedora 44 já vem com Docker. Se ainda não tem pnpm:
> ```bash
> curl -fsSL https://get.pnpm.io/install.sh | sh -
> ```

## Setup

```bash
git clone <repo>
cd tic-tac-toe-tim-online
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
```

## Rodar local

```bash
pnpm dev
```

Este comando único sobe três processos em paralelo, com logs coloridos etiquetados:

```
[redis] pronto (PONG)
[api  ] server listening on http://localhost:3001
[web  ] Vite ready on http://localhost:5173
[dev  ] tudo no ar. Ctrl+C para parar.
```

Abra `http://localhost:5173` em duas janelas anônimas (`Ctrl+Shift+N`) para simular dois jogadores.

### Comandos auxiliares

```bash
pnpm redis:up       # sobe Redis isolado
pnpm redis:down     # para Redis
pnpm redis:logs     # tail dos logs do Redis
pnpm dev:api        # só o backend
pnpm dev:web        # só o frontend
pnpm test           # roda testes em todos os pacotes
pnpm typecheck      # TypeScript em modo estrito
pnpm build          # build de produção de todos os pacotes
pnpm lint           # ESLint em todos os pacotes
pnpm clean          # remove node_modules e artefatos
```

### Testar no celular (mesma Wi-Fi)

1. Descubra o IP da máquina: `ip addr show | grep "inet " | grep -v 127.0.0.1`
2. Libere as portas no firewall Fedora:
   ```bash
   sudo firewall-cmd --add-port=5173/tcp --add-port=3001/tcp
   ```
3. No celular, abra `http://<seu-ip>:5173`.

## Estrutura

```
tic-tac-toe-tim-online/
├── apps/
│   ├── server/          # API + WebSocket (Fastify + Socket.IO)
│   └── web/             # Frontend (Vite + React)
├── packages/
│   └── shared/          # Tipos e lógica isomórfica
├── scripts/             # Orquestração de dev (Redis + servers)
├── docker-compose.yml   # Alternativa ao docker run para CI
├── turbo.json           # Pipeline de build/test/lint
├── pnpm-workspace.yaml
└── package.json
```

## Roadmap

- [x] **Etapa 1** — Esqueleto + dev local
- [ ] **Etapa 2** — Pacote `shared` (protocolo + engine)
- [ ] **Etapa 3** — Backend: HTTP + WS + Redis
- [ ] **Etapa 4** — Backend: lógica de jogo
- [ ] **Etapa 5** — Frontend: Vite + React + Tailwind
- [ ] **Etapa 6** — Frontend: tabuleiro e fluxo completo
- [ ] **Etapa 7** — Deploy Vercel + Fly.io

## Licença

MIT
