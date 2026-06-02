import { useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@ttt/shared";
import { useGameStore } from "../store/gameStore.js";

let counter = 0;
function makeMoveId(): string {
  counter += 1;
  return `${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export type GameSocketApi = {
  play: (position: number) => void;
  restart: () => void;
};

export function useGameSocket(socket: Socket): GameSocketApi {
  const updateState = useGameStore((s) => s.updateState);
  const setConnection = useGameStore((s) => s.setConnection);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    function onState(state: GameState) {
      const prev = useGameStore.getState();
      updateState({
        state,
        youAre: prev.youAre,
        names: prev.names,
        version: prev.version + 1,
      });
    }
    function onConnect() {
      setConnection("connected");
      socket.emit("state", {});
    }
    function onDisconnect() {
      setConnection("disconnected");
    }
    function onReconnectAttempt() {
      setConnection(socket.connected ? "connected" : "reconnecting");
    }
    function onError(payload: { message?: string }) {
      setError(payload?.message ?? "erro de conexão");
    }

    socket.on("state", onState);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on("error", onError);

    setConnection(socket.connected ? "connected" : "connecting");
    socket.emit("state", {});

    return () => {
      socket.off("state", onState);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reconnect_attempt", onReconnectAttempt);
      socket.off("error", onError);
    };
  }, [socket, updateState, setConnection, setError]);

  const play = useCallback(
    (position: number) => {
      socket.emit("move", { pos: position, id: makeMoveId() });
    },
    [socket],
  );

  const restart = useCallback(() => {
    socket.emit("restart", {});
  }, [socket]);

  return { play, restart };
}
