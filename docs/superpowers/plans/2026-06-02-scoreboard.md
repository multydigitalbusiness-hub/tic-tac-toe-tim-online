# Plano: Placar Cumulativo (Scoreboard)

**Data:** 2026-06-02
**Base:** Design spec `docs/superpowers/specs/2026-06-02-scoreboard-design.md` (commit `d097c45`)
**Meta:** Adicionar placar de vitórias+empates na sala, persistente entre rodadas, integrado no painel X/O.
**TDD estrito:** cada task começa com 1+ testes que falham, depois implementação para passar.
**Verificação final:** `pnpm test` (177+ → ~188), `pnpm typecheck`, `pnpm build`, E2E room com score.

---

## Fase 1: Shared (type + protocol)

### Task 1.1 — Tipo `Score` em engine.ts

**Driver:** Teste de compilação (type-only, sem runtime).

- Adicionar em `packages/shared/src/engine.ts`:
  ```ts
  export type Score = { X: number; O: number; draws: number };
  ```
- Nenhum teste de valor necessário (é só um type).
- **Verificar:** `pnpm typecheck --filter @ttt/shared` passa.

### Task 1.2 — `ServerMessage.state` ganha `score`

**Driver:** Teste em `packages/shared/src/protocol.test.ts` que constrói um `ServerMessage` com `t:"state"` incluindo `score`.

- Adicionar `score: Score` em `ServerMessage.state`.
- Re-export via `index.ts` já cobre (export * from engine).
- **Test:** `protocol.test.ts` valida que payload state com score type-checks (criar objeto literal e verificar que TS não reclama — teste de runtime simples: `expect(msg).toHaveProperty("score")`).

---

## Fase 2: Server — persistência e incremento

### Task 2.1 — RawGame + RoomView com `score`, `createRoom` inicializa

**Driver:** `manager.test.ts`
- Teste: `createRoom` retorna `view.score` com `{X:0, O:0, draws:0}`.
- Teste: `createRoom` → `getRoomAs` mantém score zerado.
- Teste: `joinRoom` → `getRoomAs` mantém score zerado (não mexe).

**Mudanças em `apps/server/src/game/manager.ts`:**
1. `RawGame` ganha `scoreX: string`, `scoreO: string`, `scoreDraw: string`.
2. `RoomView` ganha `score: Score`.
3. `dataToView` parseia `score*` com `parseInt` e monta `Score`.
4. `createRoom` inicializa `hset` com `scoreX: "0"`, `scoreO: "0"`, `scoreDraw: "0"`.
5. `joinRoom` não mexe nos scores (herdados do create).

### Task 2.2 — `playMove` incrementa score ao finalizar

**Driver:** `manager.test.ts`
- Teste: X vence → `view.score.X === 1`, O e draws permanecem 0.
- Teste: O vence → `view.score.O === 1`.
- Teste: empate → `view.score.draws === 1`.
- Teste: jogada vencedora idempotente (`sameMoveId`) não incrementa de novo.
- Teste: jogada em meio de jogo não mexe no score.

**Mudanças em `manager.ts`:**
- Após `applyMove` retornar `nextState` com `status === "finished"`:
  ```ts
  if (nextState.winner === "X") await redis.client.hincrby(k(code), "scoreX", 1);
  else if (nextState.winner === "O") await redis.client.hincrby(k(code), "scoreO", 1);
  else if (nextState.winner === "draw") await redis.client.hincrby(k(code), "scoreDraw", 1);
  ```
- A leitura pós-move (`readGame`) já captura os novos valores via `hgetall`.
- Idempotência: checar `seen` antes de processar o incremento — já está no fluxo atual (antes do `hset`/`hincrby`).

### Task 2.3 — `restartGame` preserva score

**Driver:** `manager.test.ts`
- Teste Após finish + restart + finish de novo, score.X == 2 (cumulativo).
- Teste restart não zera scores (comparar view pré-restart vs pós-restart).

**Mudanças em `manager.ts`:**
- `restartGame` NÃO toca nos campos `scoreX`/`scoreO`/`scoreDraw` do `hset`.

### Task 2.4 — WS handlers e HTTP incluem score

**Driver:** Nenhum teste novo — `broadcastRoomState` já emite `view` completo, que agora contém `score`. Confirmar via E2E depois.

---

## Fase 3: Web — store + hook + UI

### Task 3.1 — `gameStore` ganha `score`

**Driver:** `apps/web/src/store/gameStore.test.ts`
- `INITIAL.score` === `null`.
- `setRoom({..., score })` define `store.score`.
- `updateState({..., score })` atualiza `store.score`.
- `reset()` zera `score` para `null`.
- Teste: setRoom sem score → `null`.

**Mudanças em `gameStore.ts`:**
- Adicionar `score: Score | null` ao type `GameStore` e INITIAL.
- `setRoom` recebe e salva `score`.
- `updateState` recebe e salva `score`.
- `reset` limpa para `null`.

### Task 3.2 — `useGameSocket` extrai `score` do state event

**Driver:** `apps/web/src/hooks/useGameSocket.test.tsx`
- Corrigir mock de `STATE` para incluir `score`, `code`, `name`, `version` (RoomView completo).
- `onState` em `useGameSocket` deve chamar `updateState` com os dados corretos (incluindo `score`, `version` do servidor, `youAre`, `names`).
- Teste: receber state com score → store.score é atualizado.
- Teste: version do servidor é respeitada (não `prev.version + 1` local).

**Mudanças em `useGameSocket.ts`:**
- Refatorar `onState` para receber `RoomView` (não `GameState`) e destruturar `state`, `youAre`, `names`, `version`, `score`.
- Passar `score` para `updateState`.

### Task 3.3 — `Scoreboard` UI com placar + líder

**Driver:** `apps/web/src/pages/Room.test.tsx` (ou `Scoreboard.test.tsx` novo)
- Renderiza `X N` e `O N` com números grandes ao lado.
- Renderiza "EMPATES: N" centralizado abaixo do VS.
- Leader (maior score) tem borda verde; perdedor borda cyan; empate borda amarela em ambos.
- Se score for null (ainda não carregou) → mostra borda padrão sem números.

**Mudanças em `Room.tsx`:**
- `Scoreboard` recebe `score` do store (via `useGameStore`).
- Painel X mostra `X {score.X}` com classe `font-pixel text-3xl`.
- Painel O mostra `O {score.O}`.
- "EMPATES: {score.draws}" em `text-arcade-muted` pequeno no centro.
- Borda condicional:
  ```tsx
  const xLeader = score && score.X > score.O;
  const oLeader = score && score.O > score.X;
  const drawLead = score && score.X === score.O;
  const xBorder = xLeader ? "border-arcade-primary" : (drawLead ? "border-arcade-yellow" : "");
  const oBorder = oLeader ? "border-arcade-primary" : (drawLead ? "border-arcade-yellow" : "");
  ```

**Nova UI do Scoreboard:**
```
┌──────────┐        ┌──────────┐
│ X        │        │        O │
│    1     │  VS    │    2     │
│  Alice   │ EMPATES│   Bob    │
│          │    :0  │          │
└──────────┘        └──────────┘
```

### Task 3.4 — Verificar borda `arcade-yellow` no tailwind.config

**Driver:** visual.

- Conferir se `apps/web/tailwind.config.ts` tem `arcade-yellow` definido. Se não, adicionar.
- `arcade-yellow` = `#fffb96` (já usado em títulos).
- `border-arcade-yellow` deve existir nas extensions.

---

## Fase 4: E2E + verificação final

### Task 4.1 — E2E room com score cumulativo

**Driver:** `apps/server/scripts/e2e-room.mjs`
- Após primeiro jogo (X vence): validar `view.state.score.X === 1`.
- Após restart + segundo jogo (X vence de novo): validar `view.state.score.X === 2`.
- Adaptar `waitForState` para checar `v.state.score` nas asserções.

### Task 4.2 — Regenerar screenshots

- Rodar `pnpm build` + `vite preview`.
- Rodar `node apps/web/shoot.mjs`.
- Verificar visualmente screenshots 05 (X venceu com placar), 08 (mobile room).
- **IMPORTANTE:** servidor precisa estar rodando com Redis, CORS configurado para http://localhost:4173.

### Task 4.3 — Commits

- Commitar cada fase em um commit separado (ou 1 commit atômico se preferir).
- `git status` para verificar que arquivos temporários (debug*.mjs, shoot.mjs não versonado) não entram.
- Se `apps/web/src/hooks/useGameSocket.ts` e `apps/web/src/main.tsx` têm modificações não commitadas, decidir: commitar junto ou descartar.

---

## Checklist de auto-revisão

- [x] `Score` type exportado de `@ttt/shared`
- [ ] `RoomView` tem `score: Score`
- [ ] `ServerMessage.state` tem `score: Score`
- [ ] `createRoom` armazena `scoreX=0, scoreO=0, scoreDraw=0` no Redis
- [ ] `playMove` faz `hincrby` apenas 1 vez quando status vira finished
- [ ] `restartGame` NÃO toca nos scores
- [ ] `gameStore.score` atualizado em setRoom/updateState/reset
- [ ] `useGameSocket.onState` extrai `score` do payload e envia para updateState (com version do servidor)
- [ ] Web tests passam (estado inicial, setRoom com score, updateState com score)
- [ ] Server tests passam (createRoom score, playMove increment, restart preserve, idempotence)
- [ ] `border-arcade-yellow` presente no tailwind.config
- [ ] Painéis X/O com números e borda condicional de líder
- [ ] E2E valida score cumulativo em 2 rodadas
- [ ] `pnpm test` total ~188 tests
- [ ] `pnpm typecheck` em todos os pacotes
- [ ] `pnpm build` completo

## Comandos de verificação

```sh
pnpm test --filter @ttt/shared
pnpm test --filter @ttt/server
pnpm test --filter @ttt/web
pnpm typecheck
pnpm build
```
