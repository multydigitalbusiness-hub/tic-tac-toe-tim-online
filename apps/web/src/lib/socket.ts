import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export type GameSocket = Socket;

export function apiToWsUrl(apiUrl: string): string {
  return apiUrl.replace(/^http/, "ws");
}

export function getSocket(baseUrl: string, token: string): GameSocket {
  if (socket && socket.connected) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(baseUrl, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    timeout: 8000,
  });
  return socket;
}

export function disposeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
