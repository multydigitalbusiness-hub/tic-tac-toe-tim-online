import type { Server, Socket } from "socket.io";
import { verifyRoomToken, type RoomTokenPayload, type VerifyOptions } from "../auth/jwt.js";

export type SocketData = {
  user: RoomTokenPayload;
};

export type SocketWithData = Socket & { data: SocketData };

export type HubLogger = {
  info: (obj: object, msg?: string) => void;
};

export function setupSocketAuth(
  io: Server,
  jwtOptions: VerifyOptions,
  logger?: HubLogger,
): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token || typeof token !== "string") {
      return next(new Error("unauthorized: missing token"));
    }
    try {
      const payload = await verifyRoomToken(token, jwtOptions);
      (socket.data as SocketData).user = payload;
      next();
    } catch (e) {
      const reason = e instanceof Error ? e.message : "invalid";
      next(new Error(`unauthorized: ${reason}`));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket.data as SocketData).user;
    socket.join(`user:${user.sub}`);
    socket.join(`room:${user.code}`);
    logger?.info({ sub: user.sub, code: user.code, role: user.role }, "socket connected");
  });
}
