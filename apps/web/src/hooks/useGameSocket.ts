import { useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { GameState, Player, Score } from "@ttt/shared";
import { useGameStore, type Names } from "../store/gameStore.js";

let counter = 0;
function makeMoveId(): string {
  counter += 1;
  return `${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

type RoomView = {
  state: GameState;
  score: Score;
  youAre: Player | null;
  names: Names;
  version: number;
};

export type GameSocketApi = {
  play: (position: number) => void;
  restart: () => void;
};

export function useGameSocket(socket: Socket): GameSocketApi {
  const updateState = useGameStore((s) => s.updateState);
  const setConnection = useGameStore((s) => s.setConnection);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    if (!socket) return;

    function onState(view: RoomView) {
      updateState({
        state: view.state,
        score: view.score,
        youAre: view.youAre,
        names: view.names,
        version: view.version,
      });
    }
    function onConnect() {
      setConnection("connected");
      socket!.emit("state", {});
    }
    function onDisconnect() {
      setConnection("disconnected");
    }
    function onReconnectAttempt() {
      setConnection(socket!.connected ? "connected" : "reconnecting");
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
      if (!socket) return;
      socket.emit("move", { pos: position, id: makeMoveId() });
    },
    [socket],
  );

  const restart = useCallback(() => {
    if (!socket) return;
    socket.emit("restart", {});
  }, [socket]);

  return { play, restart };
}
