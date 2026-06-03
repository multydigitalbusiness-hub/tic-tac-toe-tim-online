import type { Server, Socket } from "socket.io";
import { z } from "zod";
import type { GameManager, RoomView } from "../game/manager.js";
import { RoomError } from "../game/manager.js";
import type { SocketData } from "./hub.js";
import { createTokenBucket } from "./throttle.js";

type AckOk = { ok: true; view: RoomView };
type AckErr = { ok: false; code: string; message?: string };
type Ack = AckOk | AckErr;

const movePayloadSchema = z.object({
  pos: z.number().int().min(0).max(8),
  id: z.string().min(1).max(64),
});

export type GameHandlerOptions = {
  /** Rajada de eventos permitida por socket antes do throttle. */
  burst?: number;
  /** Eventos por segundo recarregados por socket. */
  refillPerSecond?: number;
};

export async function broadcastRoomState(
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
  options: GameHandlerOptions = {},
): void {
  const bucket = createTokenBucket({
    capacity: options.burst ?? 10,
    refillPerSecond: options.refillPerSecond ?? 5,
  });

  io.on("connection", (socket) => {
    const user = (socket.data as SocketData).user;
    const { code, sub } = user;

    socket.on("move", async (payload: unknown, ack?: (r: Ack) => void) => {
      if (!bucket.tryRemove(socket.id)) {
        const err: AckErr = { ok: false, code: "RATE_LIMITED", message: "too many moves" };
        socket.emit("error", err);
        ack?.(err);
        return;
      }
      const parsed = movePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        const err: AckErr = { ok: false, code: "BAD_PAYLOAD", message: "invalid move payload" };
        socket.emit("error", err);
        ack?.(err);
        return;
      }
      try {
        await manager.playMove({ code, userId: sub, pos: parsed.data.pos, moveId: parsed.data.id });
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
      if (!bucket.tryRemove(socket.id)) {
        const err: AckErr = { ok: false, code: "RATE_LIMITED", message: "too many requests" };
        socket.emit("error", err);
        ack?.(err);
        return;
      }
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

    socket.on("disconnect", () => {
      bucket.drop(socket.id);
    });
  });
}
