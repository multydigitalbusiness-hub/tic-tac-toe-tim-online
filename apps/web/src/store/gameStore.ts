import { create } from "zustand";
import type { ConnectionStatus, GameState, Player } from "@ttt/shared";

export type Names = { X?: string; O?: string };

type GameStore = {
  code: string | null;
  token: string | null;
  state: GameState | null;
  youAre: Player | null;
  names: Names;
  version: number;
  connection: ConnectionStatus;
  error: string | null;

  setRoom: (data: {
    code: string;
    token: string;
    state: GameState;
    youAre: Player | null;
    names: Names;
    version: number;
  }) => void;
  updateState: (data: {
    state: GameState;
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
  youAre: null as Player | null,
  names: {} as Names,
  version: 0,
  connection: "disconnected" as ConnectionStatus,
  error: null as string | null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...INITIAL,

  setRoom: (data) =>
    set({
      code: data.code,
      token: data.token,
      state: data.state,
      youAre: data.youAre,
      names: data.names,
      version: data.version,
      error: null,
    }),

  updateState: (data) =>
    set((prev) => {
      if (data.version < prev.version) return prev;
      return {
        state: data.state,
        youAre: data.youAre,
        names: data.names,
        version: data.version,
      };
    }),

  setConnection: (status) => set({ connection: status }),
  setError: (msg) => set({ error: msg }),

  reset: () => set({ ...INITIAL }),
}));
