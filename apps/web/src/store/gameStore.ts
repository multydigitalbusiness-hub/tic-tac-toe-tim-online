import { create } from "zustand";
import type { ConnectionStatus, GameState, Player, Score } from "@ttt/shared";

export type Names = { X?: string; O?: string };

const SESSION_KEY = "ttt:session";

type PersistedSession = {
  code: string;
  token: string;
  youAre: Player | null;
};

function persistSession(s: PersistedSession): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // armazenamento indisponível (modo privado, quota) — ignora
  }
}

function clearSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignora
  }
}

type GameStore = {
  code: string | null;
  token: string | null;
  state: GameState | null;
  score: Score | null;
  youAre: Player | null;
  names: Names;
  version: number;
  connection: ConnectionStatus;
  error: string | null;

  setRoom: (data: {
    code: string;
    token: string;
    state: GameState;
    score: Score;
    youAre: Player | null;
    names: Names;
    version: number;
  }) => void;
  updateState: (data: {
    state: GameState;
    score: Score;
    youAre: Player | null;
    names: Names;
    version: number;
  }) => void;
  setConnection: (status: ConnectionStatus) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
};

const INITIAL = {
  code: null as string | null,
  token: null as string | null,
  state: null as GameState | null,
  score: null as Score | null,
  youAre: null as Player | null,
  names: {} as Names,
  version: 0,
  connection: "disconnected" as ConnectionStatus,
  error: null as string | null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...INITIAL,

  setRoom: (data) =>
    set(() => {
      persistSession({ code: data.code, token: data.token, youAre: data.youAre });
      return {
        code: data.code,
        token: data.token,
        state: data.state,
        score: data.score,
        youAre: data.youAre,
        names: data.names,
        version: data.version,
        error: null,
      };
    }),

  updateState: (data) =>
    set((prev) => {
      if (data.version < prev.version) return prev;
      return {
        state: data.state,
        score: data.score,
        youAre: data.youAre,
        names: data.names,
        version: data.version,
      };
    }),

  setConnection: (status) => set({ connection: status }),
  setError: (msg) => set({ error: msg }),

  reset: () => {
    clearSession();
    set({ ...INITIAL });
  },
}));

/**
 * Restaura a sessão (token/code/youAre) persistida no sessionStorage.
 * Usado no boot para sobreviver a um reload de página sem perder a sala.
 * Retorna true se uma sessão válida foi restaurada.
 */
export function loadPersistedSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (!parsed || typeof parsed.code !== "string" || typeof parsed.token !== "string") {
      return false;
    }
    useGameStore.setState({
      code: parsed.code,
      token: parsed.token,
      youAre: parsed.youAre ?? null,
    });
    return true;
  } catch {
    return false;
  }
}
