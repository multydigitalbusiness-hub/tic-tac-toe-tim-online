import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { useGameStore, loadPersistedSession } from "./store/gameStore.js";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

// Restaura a sessão (token/code) após um reload de página, evitando que o
// jogador seja expulso da própria sala.
if (typeof window !== "undefined") {
  loadPersistedSession();
}

// Hooks de teste/E2E: expostos apenas em desenvolvimento.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __ttt?: unknown }).__ttt = { store: useGameStore };
  const w = window as unknown as {
    __INIT_STORE__?: {
      code: string;
      token: string;
      state: import("@ttt/shared").GameState;
      score: import("@ttt/shared").Score;
      youAre: import("@ttt/shared").Player | null;
      names: { X?: string; O?: string };
      version: number;
    };
  };
  if (w.__INIT_STORE__) {
    useGameStore.getState().setRoom({
      code: w.__INIT_STORE__.code,
      token: w.__INIT_STORE__.token,
      state: w.__INIT_STORE__.state,
      score: w.__INIT_STORE__.score,
      youAre: w.__INIT_STORE__.youAre,
      names: w.__INIT_STORE__.names,
      version: w.__INIT_STORE__.version,
    });
    useGameStore.getState().setConnection("connected");
  }
}

createRoot(root).render(
  <StrictMode>
    <App />
    <div className="vignette" />
    <div className="scanlines" />
  </StrictMode>,
);
