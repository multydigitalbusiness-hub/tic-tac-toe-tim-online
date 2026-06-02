import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore.js";
import { newGame } from "@ttt/shared";

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("gameStore - estado inicial", () => {
  it("começa sem sala e desconectado", () => {
    const s = useGameStore.getState();
    expect(s.code).toBeNull();
    expect(s.token).toBeNull();
    expect(s.state).toBeNull();
    expect(s.youAre).toBeNull();
    expect(s.names).toEqual({});
    expect(s.version).toBe(0);
    expect(s.connection).toBe("disconnected");
    expect(s.error).toBeNull();
  });
});

describe("gameStore - setRoom", () => {
  it("define code, token, state, youAre, names, version", () => {
    const g = newGame();
    useGameStore.getState().setRoom({
      code: "ABC234",
      token: "jwt",
      state: g,
      youAre: "X",
      names: { X: "Alice" },
      version: 0,
    });
    const s = useGameStore.getState();
    expect(s.code).toBe("ABC234");
    expect(s.token).toBe("jwt");
    expect(s.state).toBe(g);
    expect(s.youAre).toBe("X");
    expect(s.names.X).toBe("Alice");
    expect(s.version).toBe(0);
  });
});

describe("gameStore - updateState", () => {
  it("atualiza state, youAre, names, version (chamado pelo WS)", () => {
    useGameStore.getState().setRoom({
      code: "ABC234",
      token: "jwt",
      state: newGame(),
      youAre: "X",
      names: { X: "Alice" },
      version: 0,
    });
    const next = { ...newGame(), board: ["X", null, null, null, null, null, null, null, null] as any, moveCount: 1, turn: "O" as const };
    useGameStore.getState().updateState({
      state: next,
      youAre: "X",
      names: { X: "Alice" },
      version: 1,
    });
    const s = useGameStore.getState();
    expect(s.state?.board[0]).toBe("X");
    expect(s.state?.turn).toBe("O");
    expect(s.version).toBe(1);
  });

  it("ignora update com versão menor (evento atrasado)", () => {
    useGameStore.getState().setRoom({
      code: "ABC234",
      token: "jwt",
      state: newGame(),
      youAre: "X",
      names: {},
      version: 5,
    });
    const oldState = { ...newGame() };
    useGameStore.getState().updateState({
      state: oldState,
      youAre: "X",
      names: {},
      version: 3,
    });
    expect(useGameStore.getState().version).toBe(5);
  });
});

describe("gameStore - setConnection", () => {
  it.each(["disconnected", "connecting", "connected", "reconnecting"] as const)(
    "atualiza connection para '%s'",
    (status) => {
      useGameStore.getState().setConnection(status);
      expect(useGameStore.getState().connection).toBe(status);
    },
  );
});

describe("gameStore - setError", () => {
  it("define mensagem de erro", () => {
    useGameStore.getState().setError("sala não encontrada");
    expect(useGameStore.getState().error).toBe("sala não encontrada");
  });
});

describe("gameStore - reset", () => {
  it("limpa todo o estado", () => {
    useGameStore.getState().setRoom({
      code: "ABC234",
      token: "jwt",
      state: newGame(),
      youAre: "X",
      names: { X: "Alice" },
      version: 0,
    });
    useGameStore.getState().setError("erro");
    useGameStore.getState().setConnection("connected");
    useGameStore.getState().reset();
    const s = useGameStore.getState();
    expect(s.code).toBeNull();
    expect(s.token).toBeNull();
    expect(s.state).toBeNull();
    expect(s.youAre).toBeNull();
    expect(s.names).toEqual({});
    expect(s.version).toBe(0);
    expect(s.connection).toBe("disconnected");
    expect(s.error).toBeNull();
  });
});
