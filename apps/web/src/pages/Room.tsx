import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore.js";
import { ConnectionBadge } from "../components/ConnectionBadge.js";
import { isValidRoomCode } from "@ttt/shared";
import { getSocket, disposeSocket } from "../lib/socket.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function Room() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const game = useGameStore((s) => s);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isValidRoomCode(code)) {
      navigate("/", { replace: true });
      return;
    }
    if (!game.token) {
      navigate(`/`, { replace: true });
      return;
    }
    const socket = getSocket(API_URL, game.token);
    socket.emit("state", {});
    return () => {
      disposeSocket();
    };
  }, [code, game.token, navigate]);

  if (!game.state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="arcade-label text-arcade-yellow animate-blink">► CARREGANDO ◄</div>
      </div>
    );
  }

  const status = game.state.status;
  const waiting = status === "waiting" && !game.state.winner;

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
        <div className="flex items-center justify-between mb-5">
          <ConnectionBadge status={game.connection} />
          <div className="arcade-label text-arcade-cyan">
            {game.youAre === "X" ? "VOCÊ É X" : "VOCÊ É O"}
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="arcade-label text-arcade-muted mb-2">CÓDIGO DA SALA</div>
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

        <div className="arcade-divider mb-5" />

        <div className="text-center mb-5">
          {waiting ? (
            <div>
              <div className="arcade-label text-arcade-pink mb-2 animate-blink">► AGUARDANDO OPONENTE ◄</div>
              <div className="font-pixel text-[10px] text-arcade-muted">
                ENVIE O CÓDIGO ACIMA PARA ALGUÉM
              </div>
            </div>
          ) : status === "playing" ? (
            <div>
              <div className="arcade-label text-arcade-primary mb-1">PARTIDA EM ANDAMENTO</div>
              <div className="font-pixel text-[10px] text-arcade-muted">
                VEZ DE: {game.state.turn === game.youAre ? "VOCÊ" : game.state.turn}
              </div>
            </div>
          ) : (
            <div>
              <div className="arcade-label text-arcade-gold mb-1">FIM DE JOGO</div>
              <div className="font-pixel text-[10px] text-arcade-muted">
                {game.state.winner === "draw"
                  ? "EMPATE!"
                  : game.state.winner === game.youAre
                    ? "VOCÊ VENCEU!"
                    : "VOCÊ PERDEU"}
              </div>
            </div>
          )}
        </div>

        <div className="arcade-panel aspect-square w-full max-w-[300px] mx-auto mb-5 flex items-center justify-center">
          <div className="text-center">
            <div className="arcade-label text-arcade-muted mb-2">TABULEIRO</div>
            <div className="font-pixel text-[10px] text-arcade-cyan/60">— ETAPA 6 —</div>
          </div>
        </div>

        <button type="button" className="arcade-btn w-full" onClick={leave}>
          ◄ EXIT · VOLTAR AO MENU
        </button>
      </div>

      <div className="mt-4 arcade-label text-arcade-muted/60 text-center">
        {game.names.X ? `X: ${game.names.X}` : "X: —"}
        {"  VS  "}
        {game.names.O ? `O: ${game.names.O}` : "O: —"}
      </div>
    </div>
  );
}
