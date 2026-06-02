import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore.js";
import { ConnectionBadge } from "../components/ConnectionBadge.js";
import { Board } from "../components/Board.js";
import { useGameSocket } from "../hooks/useGameSocket.js";
import { getSocket, disposeSocket } from "../lib/socket.js";
import { isValidRoomCode } from "@ttt/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function Room() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const game = useGameStore();
  const [copied, setCopied] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    if (!isValidRoomCode(code)) {
      navigate("/", { replace: true });
      return;
    }
    if (!game.token) {
      navigate("/", { replace: true });
      return;
    }
    const s = getSocket(API_URL, game.token);
    setSocket(s);
    return () => {
      disposeSocket();
    };
  }, [code, game.token, navigate]);

  const { play, restart } = useGameSocket(socket as Parameters<typeof useGameSocket>[0]);

  if (!socket || !game.state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="arcade-label text-arcade-yellow animate-blink">► CARREGANDO ◄</div>
      </div>
    );
  }

  const { state } = game;
  const isMyTurn = state.status === "playing" && state.turn === game.youAre;
  const boardDisabled = state.status !== "playing" || !isMyTurn;
  const isOver = state.status === "finished";

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function leave() {
    disposeSocket();
    game.reset();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md arcade-panel p-5 sm:p-7">
        <div className="flex items-center justify-between mb-4">
          <ConnectionBadge status={game.connection} />
          <div className="arcade-label text-arcade-cyan">
            VOCÊ É <span className={game.youAre === "X" ? "text-arcade-primary" : "text-arcade-pink"}>{game.youAre}</span>
          </div>
        </div>

        <div className="text-center mb-3">
          <div className="arcade-label text-arcade-muted mb-1">CÓDIGO DA SALA</div>
          <button
            type="button"
            onClick={copyCode}
            className="font-pixel text-2xl sm:text-3xl tracking-[0.35em] text-arcade-yellow
                       hover:text-arcade-gold transition-colors select-all"
            title="clique para copiar"
          >
            {code}
          </button>
          <div className="arcade-label text-arcade-muted/60 h-4 mt-1">
            {copied ? "✓ COPIADO!" : "clique para copiar"}
          </div>
        </div>

        <div className="arcade-divider mb-4" />

        <StatusBanner state={state} youAre={game.youAre} />

        <div className="relative my-4">
          <Board
            board={state.board}
            line={state.line}
            disabled={boardDisabled}
            onPlay={play}
          />
          {isOver && <GameOverOverlay state={state} youAre={game.youAre} onRestart={restart} />}
        </div>

        <Scoreboard names={game.names} youAre={game.youAre} />

        <button type="button" className="arcade-btn w-full mt-4" onClick={leave}>
          ◄ EXIT · VOLTAR AO MENU
        </button>
      </div>
    </div>
  );
}

function StatusBanner({
  state,
  youAre,
}: {
  state: NonNullable<ReturnType<typeof useGameStore.getState>["state"]>;
  youAre: ReturnType<typeof useGameStore.getState>["youAre"];
}) {
  if (state.status === "waiting") {
    return (
      <div className="text-center">
        <div className="arcade-label text-arcade-pink animate-blink">► AGUARDANDO OPONENTE ◄</div>
        <div className="arcade-label text-arcade-muted/60 mt-1">ENVIE O CÓDIGO PARA ALGUÉM</div>
      </div>
    );
  }
  if (state.status === "playing") {
    const yours = state.turn === youAre;
    return (
      <div className="text-center">
        <div
          className={`arcade-label ${yours ? "text-arcade-primary animate-blink" : "text-arcade-yellow"}`}
        >
          {yours ? "► SUA VEZ ◄" : `VEZ DE ${state.turn}`}
        </div>
      </div>
    );
  }
  return null;
}

function GameOverOverlay({
  state,
  youAre,
  onRestart,
}: {
  state: NonNullable<ReturnType<typeof useGameStore.getState>["state"]>;
  youAre: ReturnType<typeof useGameStore.getState>["youAre"];
  onRestart: () => void;
}) {
  const draw = state.winner === "draw";
  const youWon = state.winner === youAre;
  const title = draw ? "EMPATE!" : youWon ? "VOCÊ VENCEU!" : "VOCÊ PERDEU";
  const color = draw
    ? "text-arcade-yellow"
    : youWon
      ? "text-arcade-primary"
      : "text-arcade-red";
  return (
    <div className="absolute inset-0 bg-arcade-bg/85 flex flex-col items-center justify-center gap-4 animate-pop-in">
      <div className={`arcade-title text-2xl sm:text-3xl ${color} animate-flicker`}>
        {title}
      </div>
      <button
        type="button"
        className="arcade-btn arcade-btn-primary animate-glow-pulse"
        onClick={onRestart}
      >
        ► JOGAR DE NOVO
      </button>
    </div>
  );
}

function Scoreboard({
  names,
  youAre,
}: {
  names: ReturnType<typeof useGameStore.getState>["names"];
  youAre: ReturnType<typeof useGameStore.getState>["youAre"];
}) {
  const x = (
    <div className={`flex-1 arcade-panel p-2 text-center ${youAre === "X" ? "border-arcade-primary" : ""}`}>
      <div className="font-pixel text-xl text-arcade-primary">X</div>
      <div className="arcade-label text-arcade-muted mt-1 truncate">{names.X ?? "—"}</div>
    </div>
  );
  const o = (
    <div className={`flex-1 arcade-panel p-2 text-center ${youAre === "O" ? "border-arcade-pink" : ""}`}>
      <div className="font-pixel text-xl text-arcade-pink">O</div>
      <div className="arcade-label text-arcade-muted mt-1 truncate">{names.O ?? "AGUARDANDO..."}</div>
    </div>
  );
  return (
    <div className="flex gap-2">
      {x}
      <div className="flex items-center text-arcade-muted font-pixel text-xs">VS</div>
      {o}
    </div>
  );
}
