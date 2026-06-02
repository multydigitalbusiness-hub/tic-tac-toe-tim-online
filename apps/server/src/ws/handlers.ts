import type { Server, Socket } from "socket.io";
import type { GameManager, RoomView } from "../game/manager.js";
import { RoomError } from "../game/manager.js";
import type { SocketData } from "./hub.js";

type AckOk = { ok: true; view: RoomView };
type AckErr = { ok: false; code: string; message?: string };
type Ack = AckOk | AckErr;

async function broadcastRoomState(
  io: Server,
  manager: GameManager,
  code: string,
): Promise<void> {
  const sockets = await io.in(`room:${code}`).fetchSockets();
  for (const s of sockets) {
    const user = (s.data as SocketData).user;
    const view = await manager.getRoomAs(code, user.sub);
    if (view) s.emit("state", view);
  }
}

function ackError(err: unknown): AckErr {
  if (err instanceof RoomError) {
    return { ok: false, code: err.code, message: err.message };
  }
  return { ok: false, code: "INTERNAL" };
}

export function setupGameHandlers(
  io: Server,
  manager: GameManager,
): void {
  io.on("connection", (socket) => {
    const user = (socket.data as SocketData).user;
    const { code, sub } = user;

    socket.on("move", async (payload: { pos: number; id: string }, ack?: (r: Ack) => void) => {
      try {
        await manager.playMove({ code, userId: sub, pos: payload.pos, moveId: payload.id });
        await broadcastRoomState(io, manager, code);
        const view = await manager.getRoomAs(code, sub);
        if (view) ack?.({ ok: true, view });
      } catch (e) {
        const err = ackError(e);
        socket.emit("error", err);
        ack?.(err);
      }
    });

    socket.on("restart", async (_payload: unknown, ack?: (r: Ack) => void) => {
      try {
        await manager.restartGame({ code, userId: sub });
        await broadcastRoomState(io, manager, code);
        const view = await manager.getRoomAs(code, sub);
        if (view) ack?.({ ok: true, view });
      } catch (e) {
        const err = ackError(e);
        socket.emit("error", err);
        ack?.(err);
      }
    });

    socket.on("state", async (_payload: unknown, ack?: (r: Ack) => void) => {
      const view = await manager.getRoomAs(code, sub);
      if (view) {
        ack?.({ ok: true, view });
      } else {
        ack?.({ ok: false, code: "NOT_FOUND" });
      }
    });
  });
}
