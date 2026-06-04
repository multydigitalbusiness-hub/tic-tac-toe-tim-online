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
