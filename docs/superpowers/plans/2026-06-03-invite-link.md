# Convite por Link (auto-entrada via `/r/CODE`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que quem abre um link `/r/CODE` sem token entre na sala por uma tela de entrada (nome opcional + ENTRAR), tratando os erros de sala inexistente/cheia ali mesmo.

**Architecture:** Mudança 100% front-end. Um novo componente puro `JoinGate` (apresentação + callbacks) é renderizado pelo `Room.tsx` quando não há token válido para a sala. O `Room` detém o estado de rede (chamada ao `join`, busy, erro) e reusa `joinRoom`/`ApiError` da `api.ts` e `setRoom` do store (que já persiste a sessão). Nenhuma mudança no servidor ou no pacote `shared`.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, React Router, Vitest + Testing Library (jsdom).

**Base:** Design spec `docs/superpowers/specs/2026-06-03-invite-link-design.md`.

**Verificação final:** `pnpm --filter @ttt/web test`, `pnpm typecheck`, `pnpm --filter @ttt/web build`.

---

## File Structure

- **Create:** `apps/web/src/components/JoinGate.tsx` — componente puro de apresentação: form de entrada (nome + ENTRAR) ou tela de erro, com botão de voltar.
- **Create:** `apps/web/src/components/JoinGate.test.tsx` — testes RTL do componente puro.
- **Modify:** `apps/web/src/pages/Room.tsx` — decide entre conectar (tem token desta sala) ou renderizar o `JoinGate`; detém `handleJoin`/`handleBack` e o estado `joinBusy`/`joinError`.
- **Modify:** `apps/web/src/pages/Room.test.tsx` — ajusta o mock de `react`/store para cobrir o novo caminho do gate sem quebrar o teste existente.

---

## Task 1: Componente `JoinGate` (puro)

**Files:**
- Create: `apps/web/src/components/JoinGate.tsx`
- Test: `apps/web/src/components/JoinGate.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/JoinGate.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JoinGate } from "./JoinGate.tsx";

function setup(overrides: Partial<Parameters<typeof JoinGate>[0]> = {}) {
  const onJoin = vi.fn();
  const onBack = vi.fn();
  const props = {
    code: "ABC234",
    busy: false,
    error: null,
    onJoin,
    onBack,
    ...overrides,
  };
  render(<JoinGate {...props} />);
  return { onJoin, onBack };
}

describe("JoinGate", () => {
  it("mostra o código da sala e o input de nome quando não há erro", () => {
    setup();
    expect(screen.getByText(/ABC234/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("ENTRAR chama onJoin com o nome digitado", () => {
    const { onJoin } = setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onJoin).toHaveBeenCalledWith("Bob");
  });

  it("ENTRAR com nome vazio chama onJoin(undefined)", () => {
    const { onJoin } = setup();
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onJoin).toHaveBeenCalledWith(undefined);
  });

  it("busy desabilita o botão e mostra ENTRANDO", () => {
    setup({ busy: true });
    const btn = screen.getByRole("button", { name: /entrando/i });
    expect(btn).toBeDisabled();
  });

  it("erro NOT_FOUND mostra 'SALA NÃO ENCONTRADA'", () => {
    setup({ error: { code: "NOT_FOUND", message: "x" } });
    expect(screen.getByText(/sala não encontrada/i)).toBeInTheDocument();
  });

  it("erro ROOM_FULL mostra 'SALA CHEIA'", () => {
    setup({ error: { code: "ROOM_FULL", message: "x" } });
    expect(screen.getByText(/sala cheia/i)).toBeInTheDocument();
  });

  it("erro genérico mostra TENTAR DE NOVO e dispara onJoin ao clicar", () => {
    const { onJoin } = setup({ error: { code: "INTERNAL", message: "x" } });
    const retry = screen.getByRole("button", { name: /tentar de novo/i });
    fireEvent.click(retry);
    expect(onJoin).toHaveBeenCalled();
  });

  it("VOLTAR AO MENU chama onBack", () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole("button", { name: /voltar ao menu/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ttt/web exec vitest run src/components/JoinGate.test.tsx`
Expected: FAIL — `Failed to load url ./JoinGate.tsx` (módulo não existe).

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/JoinGate.tsx`:

```tsx
import { useState } from "react";

export type JoinError = { code: string; message: string };

const MAX_NAME = 20;

const TERMINAL_CODES = new Set(["NOT_FOUND", "ROOM_FULL", "INVALID_CODE"]);

function errorTitle(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "SALA NÃO ENCONTRADA";
    case "ROOM_FULL":
      return "SALA CHEIA (2/2)";
    case "INVALID_CODE":
      return "CÓDIGO INVÁLIDO";
    default:
      return "ERRO AO ENTRAR";
  }
}

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
}) {
  const [name, setName] = useState("");
  const canRetry = error !== null && !TERMINAL_CODES.has(error.code);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md arcade-panel p-6 sm:p-8 animate-pop-in">
        <div className="text-center mb-6">
          <div className="arcade-label text-arcade-cyan mb-2">— TIM ARCADE —</div>
          <h1 className="arcade-title text-xl sm:text-2xl mb-2">ENTRAR NA SALA</h1>
          <div className="font-pixel text-2xl tracking-[0.35em] text-arcade-yellow">{code}</div>
          <div className="mt-4 arcade-divider" />
        </div>

        {error ? (
          <div className="text-center">
            <div className="arcade-panel p-4 border-arcade-red text-arcade-red text-xs animate-flicker">
              ⚠ {errorTitle(error.code)}
            </div>
            {canRetry && (
              <button
                type="button"
                className="arcade-btn arcade-btn-primary w-full mt-4"
                disabled={busy}
                onClick={() => onJoin(name.trim() || undefined)}
              >
                {busy ? "ENTRANDO..." : "► TENTAR DE NOVO"}
              </button>
            )}
            <button type="button" className="arcade-btn w-full mt-3" onClick={onBack}>
              ◄ VOLTAR AO MENU
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="join-name" className="arcade-label block mb-2 text-center">
              ► SEU NOME (OPCIONAL)
            </label>
            <input
              id="join-name"
              className="arcade-input mb-4"
              maxLength={MAX_NAME}
              placeholder="PLAYER 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className="arcade-btn arcade-btn-primary w-full mb-3 animate-glow-pulse"
              disabled={busy}
              onClick={() => onJoin(name.trim() || undefined)}
            >
              {busy ? "ENTRANDO..." : "► ENTRAR"}
            </button>
            <button type="button" className="arcade-btn w-full" onClick={onBack}>
              ◄ VOLTAR AO MENU
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ttt/web exec vitest run src/components/JoinGate.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/JoinGate.tsx apps/web/src/components/JoinGate.test.tsx
git commit -m "feat(web): JoinGate component for invite-link entry"
```

---

## Task 2: Integrar o `JoinGate` no `Room.tsx`

**Files:**
- Modify: `apps/web/src/pages/Room.tsx`
- Test: `apps/web/src/pages/Room.test.tsx`

- [ ] **Step 1: Write the failing test (gate aparece sem token)**

In `apps/web/src/pages/Room.test.tsx`, the existing file mocks `react`, the store, the socket and the router. We add a SECOND `describe` block in a NEW test file to avoid disturbing the existing module-level mocks, because the existing test mocks `react`'s `useState`/`useEffect` globally for that file.

Create `apps/web/src/pages/Room.joingate.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store sem token -> Room deve mostrar o JoinGate, não redirecionar.
const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ code: "ABC234" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../store/gameStore.js", () => ({
  useGameStore: () => ({
    code: null,
    token: null,
    state: null,
    score: null,
    youAre: null,
    names: {},
    version: 0,
    connection: "disconnected",
    error: null,
    setRoom: vi.fn(),
    updateState: vi.fn(),
    setConnection: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("../hooks/useGameSocket.js", () => ({
  useGameSocket: () => ({ play: vi.fn(), restart: vi.fn() }),
}));

vi.mock("../lib/socket.js", () => ({
  getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn(), disconnect: vi.fn() }),
  apiToWsUrl: () => "ws://localhost:3001",
  disposeSocket: vi.fn(),
}));

import { Room } from "./Room.tsx";

describe("Room - JoinGate (sem token)", () => {
  beforeEach(() => navigateMock.mockClear());
  afterEach(() => vi.clearAllMocks());

  it("renderiza o JoinGate quando não há token para a sala", async () => {
    render(<Room />);
    expect(await screen.findByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/ABC234/)).toBeInTheDocument();
  });

  it("não redireciona para o Home quando o código é válido mas falta token", () => {
    render(<Room />);
    expect(navigateMock).not.toHaveBeenCalledWith("/", { replace: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ttt/web exec vitest run src/pages/Room.joingate.test.tsx`
Expected: FAIL — atualmente o `Room` faz `navigate("/")` quando não há token, então o botão "ENTRAR" não é encontrado.

- [ ] **Step 3: Implement the changes in `Room.tsx`**

Replace the imports block and the component body of `apps/web/src/pages/Room.tsx`. Apply these edits:

3a. Update imports (add `joinRoom`/`ApiError` and `JoinGate`):

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore.js";
import { ConnectionBadge } from "../components/ConnectionBadge.js";
import { Board } from "../components/Board.js";
import { Scoreboard } from "../components/Scoreboard.js";
import { JoinGate, type JoinError } from "../components/JoinGate.js";
import { useGameSocket } from "../hooks/useGameSocket.js";
import { getSocket, disposeSocket, apiToWsUrl } from "../lib/socket.js";
import { joinRoom, ApiError } from "../lib/api.js";
import { isValidRoomCode } from "@ttt/shared";
```

3b. Replace the top of the `Room` component (state + effect) with this:

```tsx
export function Room() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const game = useGameStore();
  const [copied, setCopied] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof getSocket> | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<JoinError | null>(null);

  const hasRoomToken = Boolean(game.token) && game.code === code;

  useEffect(() => {
    if (!isValidRoomCode(code)) {
      navigate("/", { replace: true });
      return;
    }
    if (!hasRoomToken) {
      return; // mostra o JoinGate; não conecta ainda
    }
    const s = getSocket(WS_URL, game.token as string);
    setSocket(s);
    return () => {
      disposeSocket();
    };
  }, [code, hasRoomToken, game.token, navigate]);

  async function handleJoin(name?: string) {
    setJoinError(null);
    setJoinBusy(true);
    try {
      const res = await joinRoom(API_URL, { code, name });
      game.setRoom({
        code: res.code,
        token: res.token,
        state: res.state,
        score: res.score,
        youAre: "O",
        names: res.names,
        version: res.version,
      });
    } catch (e) {
      if (e instanceof ApiError) setJoinError({ code: e.code, message: e.message });
      else setJoinError({ code: "INTERNAL", message: "erro ao entrar" });
    } finally {
      setJoinBusy(false);
    }
  }

  function handleBack() {
    game.reset();
    navigate("/");
  }

  if (!hasRoomToken) {
    return (
      <JoinGate
        code={code}
        busy={joinBusy}
        error={joinError}
        onJoin={handleJoin}
        onBack={handleBack}
      />
    );
  }
```

NOTE: The rest of the component (the `if (!socket || !game.state)` loading guard, `copyCode`, `shareLink`, `leave`, and the JSX) stays exactly as-is. The `const { play, restart } = useGameSocket(...)` line stays where it is, right after this block.

- [ ] **Step 4: Run the new test to verify it passes**

Run: `pnpm --filter @ttt/web exec vitest run src/pages/Room.joingate.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing Room test to verify no regression**

Run: `pnpm --filter @ttt/web exec vitest run src/pages/Room.test.tsx`
Expected: PASS (1 test — "renderiza botão de compartilhamento"). The existing test's store mock has `token: "fake-token"` and code `ABC123` with `useParams` `code: "ABC123"`, so `hasRoomToken` is true and the board path renders as before.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Room.tsx apps/web/src/pages/Room.joingate.test.tsx
git commit -m "feat(web): auto-entry JoinGate flow in Room for /r/CODE links"
```

---

## Task 3: Verificação final do pacote web

**Files:** none (verificação).

- [ ] **Step 1: Run the full web test suite**

Run: `pnpm --filter @ttt/web test`
Expected: PASS — todos os testes web (anteriores + 8 do JoinGate + 2 do Room gate).

- [ ] **Step 2: Typecheck (todos os pacotes)**

Run: `pnpm typecheck`
Expected: PASS, exit 0.

- [ ] **Step 3: Build do web**

Run: `pnpm --filter @ttt/web build`
Expected: build conclui sem erros (`tsc -b && vite build`).

- [ ] **Step 4: Commit (se algo foi ajustado durante a verificação)**

Se nada mudou, pular. Caso contrário:

```bash
git add -A
git commit -m "chore(web): fixups after invite-link verification"
```

---

## Self-Review (do autor do plano)

**Spec coverage:**
- Tela de entrada sem token → Task 1 (JoinGate) + Task 2 (render no Room). ✔
- Entrar leva ao tabuleiro como "O" → Task 2 `handleJoin` (`youAre: "O"`, `setRoom` torna `hasRoomToken` true → effect conecta). ✔
- Token da própria sala conecta direto → Task 2 `hasRoomToken` + teste de regressão no Step 5. ✔
- Erros 404/409/rede no gate → Task 1 (mapa de erros, terminal vs retry) + Task 2 (`joinError`). ✔
- Código inválido redireciona ao Home → Task 2 effect (preservado). ✔
- Sem mudanças no servidor/shared → confirmado (nenhuma task toca neles). ✔

**Placeholder scan:** nenhum TBD/TODO; todo passo de código mostra o código completo. ✔

**Type consistency:** `JoinError` definido em `JoinGate.tsx` e importado no `Room.tsx`; `joinRoom`/`ApiError` já existem em `api.ts` com `code`/`message`/`status`; `setRoom` recebe exatamente os campos usados. ✔

**Decisão de teste:** criei `Room.joingate.test.tsx` separado em vez de editar `Room.test.tsx` porque o teste existente mocka `react` (useState/useEffect) globalmente naquele arquivo, o que tornaria frágil adicionar o caminho do gate. Arquivo separado isola os mocks por arquivo (padrão do Vitest).
