# Placar por Rodada — Design

**Data:** 2026-06-02
**Status:** Aprovado (aguarda revisão final do usuário)

## Motivação

O MVP atual tem um overlay "VOCÊ VENCEU! / PERDEU / EMPATE!" que some no "JOGAR DE NOVO". Não há memória entre rodadas — toda partida começa do zero emocional. O usuário quer um placar cumulativo por sala, visível desde o início da rodada.

## Escopo

**Dentro:**
- Placar cumulativo de vitórias e empates por jogador dentro da mesma sala.
- Persiste entre rodadas; sobrevive ao "JOGAR DE NOVO".
- Reset apenas por TTL (24h) ou ao sair e criar sala nova.
- Visível desde o início da partida (não só no game-over).
- UI integrada ao painel X/O existente embaixo do tabuleiro.

**Fora (YAGNI):**
- Best-of-N / alvo de vitórias para encerrar a partida.
- Histórico de rodadas.
- Botão "zerar placar" — pra resetar, saem da sala e criam nova.
- Placar persistido entre salas (cross-room ranking).
- Placar compartilhado com espectadores (apenas os 2 jogadores).
- Replay das rodadas anteriores.

## Decisões do design

1. **Score não é parte de `GameState`.** O `GameState` continua puro (uma partida isolada). Placar é da sala. Vai num tipo separado `Score = { X: number; O: number; draws: number }`.
2. **Score vem no payload do WS junto com o `state`.** Sem round-trip extra. Adicionado ao `ServerMessage.state` e ao `RoomView` do manager.
3. **Empates contados separadamente.** `scoreDraws` próprio, exibido secundário no centro.
4. **Destaque visual de líder.** Quem tem mais vitórias ganha borda neon verde; perdedor fica com cor normal; empate → ambos com borda amarela.

## Mudanças por camada

### `packages/shared/src/engine.ts`

Adiciona o tipo (sem afetar `GameState`):

```ts
export type Score = { X: number; O: number; draws: number };
```

### `packages/shared/src/protocol.ts`

`ServerMessage.state` ganha `score: Score`. Nenhum client message muda.

```ts
| {
    t: "state";
    code: string;
    state: GameState;
    youAre: Player | null;
    names: { X?: string; O?: string };
    score: Score;
    version: number;
  }
```

### `apps/server/src/game/manager.ts`

- `RawGame` ganha `scoreX`, `scoreO`, `scoreDraw` (strings, padrão existente).
- `RoomView` ganha `score: Score`.
- `dataToView` reconstrói `score` no retorno.
- `createRoom` inicializa os 3 em `"0"`.
- `joinRoom` não mexe no placar.
- `playMove`: depois do `hset` do novo `nextState`, **se** `nextState.status === "finished"`, faz um `hincrby` no campo correspondente:
  - `winner === "X"` → `scoreX`
  - `winner === "O"` → `scoreO`
  - `winner === "draw"` → `scoreDraw`
- `restartGame` **não** mexe nos campos `scoreX`/`scoreO`/`scoreDraw` — só reseta `board`/`turn`/`status`/`winner`/`line`/`moveCount`/`ver` e a moves-set.

### `apps/web/src/store/gameStore.ts`

- `GameStore` ganha `score: Score | null` e o campo entra em `setRoom` / `updateState`.
- `INITIAL.score = null`.
- `reset` zera o score junto.

### `apps/web/src/pages/Room.tsx`

`Scoreboard` é reescrito:

```
┌──────────┐  VS  ┌──────────┐
│  X   2   │      │  O   1   │
│  ALICE   │      │  BOB     │
└──────────┘      └──────────┘
       EMPATES: 0
```

- O número grande vai ao lado do símbolo (X/O), mesmo tamanho.
- Nome do jogador fica abaixo.
- "VS" continua no centro (mesma linha do número).
- Linha secundária abaixo: "EMPATES: 0" centralizada, `arcade-label`, `text-arcade-muted`.
- Borda do painel: vencedor → `border-arcade-primary` (verde); perdedor → borda padrão; empate → ambos `border-arcade-yellow`.

## Testes

### Unit (engine)
- Nenhum teste novo em `engine.test.ts` — `Score` é só tipo.

### Unit (manager)
- `createRoom` retorna `score: { X: 0, O: 0, draws: 0 }`.
- `playMove` com vitória de X incrementa `scoreX` em 1; placar de O/draw inalterado.
- `playMove` com vitória de O incrementa `scoreO` em 1.
- `playMove` com empate incrementa `scoreDraw` em 1.
- `playMove` em célula não-terminal **não** muda placar algum.
- `playMove` idempotente (mesmo `moveId`) **não** incrementa placar duas vezes.
- `restartGame` preserva `scoreX`/`scoreO`/`scoreDraw` entre rodadas.
- Sequência: criar → X vence → reiniciar → X vence de novo → placar é `{ X: 2, O: 0, draws: 0 }`.

### Unit (protocol)
- `ServerMessage.state` parseado pelo validador aceita o campo `score` (se houver validador; senão, garantir type-safety).
- Snapshot do jogo com placar não-zero é entregue corretamente via `getRoom`/`getRoomAs`.

### Web (store + componente)
- `setRoom` popula `score` corretamente.
- `updateState` atualiza `score` (junto com o resto) e respeita o version filter.
- Componente `Scoreboard` (componente puro testado via RTL) renderiza os números e aplica a classe de borda correta em cada cenário: X líder, O líder, empate, 0–0.

### E2E
- Script `apps/server/scripts/e2e-room.mjs` (existente) ganha mais um passo: depois do X vencer a primeira partida, chama `restart` (algum cliente emite `{ t: "restart" }`), joga de novo com X vencendo, e valida via `getRoom` que `score.X === 2`.

## Erros e casos de borda

- `playMove` chamado em jogo já finalizado: rejeitado por `applyMove` (joga `InvalidMoveError` → `RoomError("INVALID_MOVE")`). Placar não muda.
- `playMove` com `moveId` duplicado: idempotente — placar não é incrementado de novo.
- Cliente Web com score `null` (estado inicial, antes do primeiro `state`): `Scoreboard` mostra "0" nos dois lados e "EMPATES: 0". Sem crash.
- Sala expira (24h): placar some junto. Sem migração / backup.

## Performance

- Um `hincrby` extra por partida finalizada (3 nanosegundos em Redis).
- Payload do WS cresce ~24 bytes (3 ints serializados em JSON). Insignificante.

## Critérios de aceitação

1. `pnpm test` verde (todos os pacotes).
2. `pnpm typecheck` verde.
3. E2E script passa incluindo o novo cenário de placar cumulativo.
4. Screenshot do `05-room-x-venceu.png` (regenerado) mostra **o placar atualizado no painel X/O**: X=1, O=0, Empates=0.
5. Após reiniciar a partida pelo botão e vencer de novo, novo screenshot mostra **X=2, O=0, Empates=0** com a borda de X em verde.
