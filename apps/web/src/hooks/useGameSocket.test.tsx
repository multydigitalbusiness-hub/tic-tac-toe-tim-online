import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameSocket } from "./useGameSocket.js";
import { useGameStore } from "../store/gameStore.js";
import type { Socket } from "socket.io-client";
import type { GameState, Score } from "@ttt/shared";

function makeMockSocket() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    connected: false,
    emit: vi.fn(),
    on(event: string, h: (...args: unknown[]) => void) {
      (handlers[event] ??= []).push(h);
    },
    off(event: string, h: (...args: unknown[]) => void) {
      handlers[event] = (handlers[event] ?? []).filter((x) => x !== h);
    },
    fire(event: string, ...args: unknown[]) {
      for (const h of handlers[event] ?? []) h(...args);
    },
    disconnect: vi.fn(),
  } as unknown as Socket & { fire: (e: string, ...a: unknown[]) => void };
}

const SCORE: Score = { X: 0, O: 0, draws: 0 };

const STATE: GameState = {
  board: ["X", null, null, null, null, null, null, null, null],
  turn: "O",
  status: "playing",
  winner: null,
  line: null,
  moveCount: 1,
};

const VIEW = {
  code: "ABC234",
  state: STATE,
  score: SCORE,
  youAre: "X" as const,
  names: {} as { X?: string; O?: string },
  version: 1,
};

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("useGameSocket", () => {
  it("registra listeners e pede state inicial", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    expect(sock.emit).toHaveBeenCalledWith("state", {});
  });

  it("atualiza o store quando recebe state do servidor", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("state", VIEW));
    expect(useGameStore.getState().state).toEqual(STATE);
  });

  it("extrai score do view e atualiza o store", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("state", { ...VIEW, score: { X: 1, O: 0, draws: 0 } }));
    expect(useGameStore.getState().score).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it("usa version do servidor (não local counter)", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("state", { ...VIEW, version: 42 }));
    expect(useGameStore.getState().version).toBe(42);
  });

  it("atualiza youAre e names do view", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("state", { ...VIEW, youAre: "O", names: { O: "Bob" } }));
    expect(useGameStore.getState().youAre).toBe("O");
    expect(useGameStore.getState().names.O).toBe("Bob");
  });

  it("marca conexão como connected no evento connect", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("connect"));
    expect(useGameStore.getState().connection).toBe("connected");
  });

  it("marca conexão como disconnected no evento disconnect", () => {
    const sock = makeMockSocket();
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("disconnect", "io server disconnect"));
    expect(useGameStore.getState().connection).toBe("disconnected");
  });

  it("marca conexão como reconnecting quando socket está desconectado e reconectando", () => {
    const sock = makeMockSocket();
    (sock as unknown as { connected: boolean }).connected = false;
    renderHook(() => useGameSocket(sock));
    act(() => sock.fire("reconnect_attempt", 1));
    expect(useGameStore.getState().connection).toBe("reconnecting");
  });

  it("expor play() que emite move com pos e id", () => {
    const sock = makeMockSocket();
    const { result } = renderHook(() => useGameSocket(sock));
    act(() => result.current.play(4));
    expect(sock.emit).toHaveBeenCalledWith(
      "move",
      expect.objectContaining({ pos: 4, id: expect.any(String) }),
    );
  });

  it("expor restart() que emite restart", () => {
    const sock = makeMockSocket();
    const { result } = renderHook(() => useGameSocket(sock));
    act(() => result.current.restart());
    expect(sock.emit).toHaveBeenCalledWith("restart", {});
  });

  it("limpa listeners no unmount", () => {
    const sock = makeMockSocket();
    const offSpy = vi.spyOn(sock, "off");
    const { unmount } = renderHook(() => useGameSocket(sock));
    unmount();
    expect(offSpy).toHaveBeenCalledWith("state", expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith("reconnect_attempt", expect.any(Function));
  });
});
