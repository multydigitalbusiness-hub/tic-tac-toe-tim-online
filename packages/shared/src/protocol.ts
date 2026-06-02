import type { GameState, Player } from "./engine.js";

/** Mensagens enviadas pelo cliente ao servidor via Socket.IO. */
export type ClientMessage =
  | { t: "create"; name?: string }
  | { t: "join"; code: string; name?: string }
  | { t: "leave"; code: string }
  | { t: "move"; code: string; pos: number; id: string }
  | { t: "restart"; code: string }
  | { t: "state"; code: string };

/** Mensagens enviadas pelo servidor aos clientes. */
export type ServerMessage =
  | {
      t: "state";
      code: string;
      state: GameState;
      youAre: Player | null;
      names: { X?: string; O?: string };
      version: number;
    }
  | { t: "created"; code: string; youAre: Player }
  | { t: "error"; code?: string; message: string }
  | { t: "opponent_left"; code: string }
  | { t: "opponent_joined"; code: string };

/** Estado da conexão WS exposto ao cliente. */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

/** Gera um código de sala curto e amigável (6 chars, sem ambiguidade). */
export function generateRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Valida se a string é um código de sala no formato esperado. */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code);
}
