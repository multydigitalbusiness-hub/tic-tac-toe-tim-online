# Convite por Link — Auto-entrada via `/r/CODE` — Design

**Data:** 2026-06-03
**Status:** Aprovado (aguarda revisão final do usuário)

## Motivação

Hoje a sala já tem um botão "📤 COMPARTILHAR" que copia `${origin}/r/CODE` para a área de transferência. Mas quem abre esse link **sem ter um token** é redirecionado de volta para o Home (`Room.tsx` faz `navigate("/")` quando `!game.token`). O fluxo de convite fica quebrado: o link não convida ninguém de fato.

O objetivo é fechar esse fluxo: abrir `/r/CODE` deve permitir que o visitante entre na sala diretamente a partir do link.

## Escopo

**Dentro:**
- Abrir `/r/CODE` sem token mostra uma tela de entrada (nome opcional + ENTRAR) na própria página da sala.
- Entrar pelo botão faz `join` e leva ao tabuleiro como jogador "O".
- Abrir `/r/CODE` com token válido **da mesma sala** conecta direto (sem tela de entrada).
- Erros de `join` (sala inexistente, cheia, rede) são exibidos na própria tela de entrada, com saída para o menu.

**Fora (YAGNI):**
- Prévia do estado da sala antes de entrar (nome do host, "aguardando oponente").
- Endpoint público de leitura de sala (`GET /api/rooms/:code`).
- Escolher entrar como X.
- Spectator / 3+ participantes.
- Mudança no formato do link (continua `/r/CODE`).
- Qualquer mudança no servidor ou no pacote `shared`.

## Decisões do design

1. **Toda a lógica fica no front-end.** O endpoint `POST /api/rooms/:code/join` já cria o guest, retorna token (role O), e sinaliza `404 NOT_FOUND` / `409 ROOM_FULL`. Nenhuma mudança de servidor é necessária.

2. **`Room.tsx` ganha três caminhos**, decididos pelo token no store (persistido em `sessionStorage`):
   - **Tem token desta sala** (`game.token` existe **e** `game.code === code`): conecta no WS e mostra o tabuleiro (comportamento atual preservado).
   - **Não tem token desta sala**: renderiza `<JoinGate>` (tela de entrada). Antes, esse caso redirecionava para o Home — essa linha sai.
   - **Join falhou**: o `JoinGate` mostra o erro no lugar do form.

3. **`JoinGate` é um componente puro de apresentação.** Recebe `code`, `busy`, `error`, `onJoin`, `onBack`. Gerencia apenas o input de nome internamente. Todo o estado de rede (chamada ao `join`, `busy`, `error`) vive no `Room`. Mesmo padrão do `Scoreboard` — trivial de testar via RTL.

4. **Código inválido continua redirecionando ao Home.** `isValidRoomCode(code)` falso → `navigate("/", { replace: true })` (comportamento atual).

5. **Trocar de sala via link é seguro.** Se o visitante tem token de **outra** sala, o `JoinGate` aparece para a sala do link; ao entrar, `setRoom` sobrescreve token/code/youAre e persiste a nova sessão. Não há vazamento de estado da sala anterior.

## Fluxo

```
abrir /r/CODE
   │
   ├─ isValidRoomCode(code)? ── não ──► navigate("/")  (Home)
   │            │ sim
   │            ▼
   ├─ tem token E game.code === code? ── sim ──► conecta WS ──► TABULEIRO
   │            │ não
   │            ▼
   │      ┌─────────────┐   ENTRAR (joinRoom)        sucesso (setRoom)
   │      │  JoinGate    │ ───────────────────────────────────────────► TABULEIRO
   │      │  (form nome) │ ◄── erro (404/409/rede) ── exibe erro no gate
   │      └─────────────┘
   │            │ VOLTAR AO MENU → reset() + navigate("/")
```

## Mudanças por arquivo

### Novo: `apps/web/src/components/JoinGate.tsx`

Componente puro. Props:

```ts
type JoinError = { code: string; message: string };

export function JoinGate({
  code,
  busy,
  error,
  onJoin,
  onBack,
}: {
  code: string;
  busy: boolean;
  error: JoinError | null;
  onJoin: (name?: string) => void;
  onBack: () => void;
}): JSX.Element
```

Comportamento:
- Estado interno: `const [name, setName] = useState("")` (input opcional, `maxLength=20`).
- `error === null` → renderiza form: título "ENTRAR NA SALA", código em destaque (`SALA {code}`), input de nome, botão "► ENTRAR" (desabilitado e com texto "ENTRANDO..." quando `busy`), botão "◄ VOLTAR AO MENU".
- `error !== null` → renderiza a tela de erro: mensagem mapeada de `error.code`, botão "► TENTAR DE NOVO" (só para erros não-terminais; chama `onJoin` de novo com o nome atual) e "◄ VOLTAR AO MENU".
- `onJoin` recebe `name.trim() || undefined`.

Mapa de mensagens (`error.code` → texto):
- `NOT_FOUND` → "SALA NÃO ENCONTRADA"
- `ROOM_FULL` → "SALA CHEIA (2/2)"
- demais → "ERRO AO ENTRAR" + permite "TENTAR DE NOVO"

Estilo arcade reutilizando as classes existentes (`arcade-panel`, `arcade-input`, `arcade-btn`, `arcade-btn-primary`, `arcade-label`, `border-arcade-red`).

### Alterado: `apps/web/src/pages/Room.tsx`

- Importa `JoinGate` e `joinRoom`/`ApiError` de `../lib/api.js`.
- Novo estado local: `const [joinBusy, setJoinBusy] = useState(false)` e `const [joinError, setJoinError] = useState<JoinError | null>(null)`.
- Define `hasRoomToken = Boolean(game.token) && game.code === code`.
- `useEffect` de socket:
  - mantém o redirect para código inválido;
  - **remove** o redirect para `!game.token`;
  - só cria o socket quando `hasRoomToken` é verdadeiro (não conecta enquanto o gate está aberto).
- Render: se `!hasRoomToken`, retorna `<JoinGate code={code} busy={joinBusy} error={joinError} onJoin={handleJoin} onBack={handleBack} />` (envolto no layout de tela cheia padrão).
- `handleJoin(name?)`:
  ```
  setJoinError(null); setJoinBusy(true);
  try {
    const res = await joinRoom(API_URL, { code, name });
    setRoom({ code: res.code, token: res.token, state: res.state,
              score: res.score, youAre: "O", names: res.names, version: res.version });
    // hasRoomToken passa a ser true → re-render conecta e mostra o tabuleiro
  } catch (e) {
    if (e instanceof ApiError) setJoinError({ code: e.code, message: e.message });
    else setJoinError({ code: "INTERNAL", message: "erro ao entrar" });
  } finally { setJoinBusy(false); }
  ```
- `handleBack()`: `game.reset(); navigate("/")`.

### Sem alterações

- `apps/web/src/lib/api.ts` — `joinRoom`/`ApiError` já entregam `code`/`message`/`status`.
- `apps/web/src/store/gameStore.ts` — `setRoom` já persiste a sessão.
- `apps/web/src/lib/socket.ts`, `useGameSocket.ts` — inalterados.
- `apps/server/**`, `packages/shared/**` — inalterados.

## Testes

### Novo: `apps/web/src/components/JoinGate.test.tsx` (RTL, componente puro)

- Renderiza o código da sala e o input de nome quando `error` é null.
- "ENTRAR" chama `onJoin` com o nome digitado.
- "ENTRAR" com nome vazio chama `onJoin(undefined)`.
- `busy=true` desabilita o botão e mostra "ENTRANDO...".
- `error.code === "NOT_FOUND"` → exibe "SALA NÃO ENCONTRADA".
- `error.code === "ROOM_FULL"` → exibe "SALA CHEIA".
- erro genérico → exibe "TENTAR DE NOVO"; clicar dispara `onJoin`.
- "VOLTAR AO MENU" chama `onBack`.

### Alterado: `apps/web/src/pages/Room.test.tsx`

- O mock atual de `react` (mock manual de `useState`/`useEffect`) será ajustado com cuidado para suportar os novos `useState` sem quebrar o teste existente do botão "COMPARTILHAR".
- Novo caso: sem token para a sala → o JoinGate é renderizado (não redireciona ao Home).
- Caso atual (com token desta sala) permanece válido (tabuleiro/compartilhar).

### Sem novos testes de servidor

`routes.test.ts` já cobre `join` 200/404/409.

## Casos de borda

- **Token de outra sala:** gate aparece para a sala do link; `setRoom` sobrescreve no sucesso. Sem vazamento.
- **Código inválido na URL:** redireciona ao Home (comportamento atual).
- **Erro de rede:** `ApiError(status=0)` cai no ramo genérico com "TENTAR DE NOVO".
- **Dupla submissão:** `joinBusy` desabilita o botão durante a chamada.
- **Sala cheia depois de carregar o gate:** o erro só aparece após o clique (decisão da opção A — sem prévia do estado da sala).

## Critérios de aceitação

1. `pnpm test` verde em todos os pacotes, incluindo os novos testes do `JoinGate`.
2. `pnpm typecheck` verde.
3. `pnpm build` (web) completo.
4. Abrir `/r/CODE` de sala válida **sem token** mostra a tela de entrada; entrar leva ao tabuleiro como "O".
5. Abrir `/r/CODE` **com token da própria sala** vai direto ao tabuleiro (sem tela de entrada).
6. Link de sala inexistente → "SALA NÃO ENCONTRADA"; sala cheia → "SALA CHEIA", ambos com saída para o menu.
