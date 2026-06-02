import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom, ApiError } from "../lib/api.js";
import { useGameStore } from "../store/gameStore.js";
import { isValidRoomCode } from "@ttt/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const MAX_NAME = 20;

export function Home() {
  const navigate = useNavigate();
  const setRoom = useGameStore((s) => s.setRoom);
  const setError = useGameStore((s) => s.setError);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleCreate() {
    setLocalError(null);
    setBusy("create");
    try {
      const res = await createRoom(API_URL, { name: name.trim() || undefined });
      setRoom({
        code: res.code,
        token: res.token,
        state: res.state,
        youAre: "X",
        names: res.names,
        version: res.version,
      });
      navigate(`/r/${res.code}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "erro ao criar sala";
      setLocalError(msg);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    setLocalError(null);
    const normalized = code.trim().toUpperCase();
    if (!isValidRoomCode(normalized)) {
      setLocalError("código inválido (6 caracteres A-Z 2-9)");
      return;
    }
    setBusy("join");
    try {
      const res = await joinRoom(API_URL, { code: normalized, name: name.trim() || undefined });
      setRoom({
        code: res.code,
        token: res.token,
        state: res.state,
        youAre: "O",
        names: res.names,
        version: res.version,
      });
      navigate(`/r/${res.code}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "erro ao entrar";
      setLocalError(msg);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl arcade-panel p-6 sm:p-10 animate-pop-in">
        <div className="text-center mb-8">
          <div className="arcade-label mb-3 text-arcade-cyan">— TIM ARCADE —</div>
          <h1 className="arcade-title text-2xl sm:text-4xl mb-3 animate-flicker">TIC · TAC · TOE</h1>
          <div className="arcade-label text-arcade-pink">ONLINE&nbsp;&nbsp;MULTIPLAYER</div>
          <div className="mt-4 arcade-divider" />
        </div>

        <div className="mb-6">
          <label htmlFor="name" className="arcade-label block mb-2 text-center">
            ► SEU NOME (OPCIONAL)
          </label>
          <input
            id="name"
            className="arcade-input"
            maxLength={MAX_NAME}
            placeholder="PLAYER 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="arcade-btn arcade-btn-primary w-full mb-3 animate-glow-pulse"
          disabled={busy !== null}
          onClick={handleCreate}
        >
          {busy === "create" ? "CRIANDO..." : "► PRESS START · CRIAR SALA"}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-arcade-line" />
          <span className="arcade-label text-arcade-muted">OU</span>
          <div className="flex-1 h-px bg-arcade-line" />
        </div>

        <label htmlFor="code" className="arcade-label block mb-2 text-center">
          ► CÓDIGO DA SALA
        </label>
        <input
          id="code"
          className="arcade-input mb-3 text-lg tracking-[0.4em]"
          maxLength={6}
          placeholder="A2B3C4"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
        />
        <button
          type="button"
          className="arcade-btn w-full"
          disabled={busy !== null || code.length !== 6}
          onClick={handleJoin}
        >
          {busy === "join" ? "ENTRANDO..." : "► INSERT COIN · ENTRAR"}
        </button>

        {localError && (
          <div className="mt-4 arcade-panel p-3 border-arcade-red text-arcade-red text-[10px] text-center animate-flicker">
            ⚠ {localError}
          </div>
        )}
      </div>

      <div className="mt-6 arcade-label text-arcade-muted/60 text-center">
        © 1986 TIM ARCADE · BRAZIL
      </div>
    </div>
  );
}
