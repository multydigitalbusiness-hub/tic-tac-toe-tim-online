import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import type { Server as SocketIOServer } from "socket.io";
import { z, ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { generateRoomCode, isValidRoomCode } from "@ttt/shared";
import type { RedisHandle } from "../db/redis.js";
import { type GameManager, RoomError } from "../game/manager.js";
import { signRoomToken } from "../auth/jwt.js";
import { broadcastRoomState } from "../ws/handlers.js";

export type JwtConfig = {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
};

export type HealthDeps = {
  redis: RedisHandle;
};

export const registerHealthRoutes: FastifyPluginAsync<HealthDeps> = async (
  app: FastifyInstance,
  opts,
) => {
  const { redis } = opts;

  app.get("/health", async (_req, reply) => {
    try {
      await redis.ping();
      return reply.code(200).send({ ok: true, redis: "up" });
    } catch (e) {
      app.log.error({ err: e }, "redis health check failed");
      return reply.code(503).send({ ok: false, redis: "down" });
    }
  });
};

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "invalid request body",
        issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    if (err instanceof RoomError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "ROOM_FULL" ? 409 : 400;
      return reply.code(status).send({ code: err.code, message: err.message });
    }
    if ((err as { statusCode?: number }).statusCode === 429 || (err as { code?: string }).code === "RATE_LIMITED") {
      const e = err as { code?: string; message?: string };
      return reply.code(429).send({
        code: "RATE_LIMITED",
        message: e.message ?? "too many requests",
      });
    }
    app.log.error({ err }, "unhandled error");
    return reply.code(500).send({ code: "INTERNAL", message: "internal server error" });
  });
}

export type RateLimitConfig = {
  max: number;
  timeWindow: string | number;
};

export type RoomRoutesDeps = {
  manager: GameManager;
  io: SocketIOServer;
  rateLimit?: RateLimitConfig;
} & JwtConfig;

const nameSchema = z.string().trim().min(1).max(20).optional();
const createBody = z.object({ name: nameSchema });
const joinBody = z.object({ name: nameSchema });
const paramsSchema = z.object({ code: z.string() });

const DEFAULT_RATE_LIMIT: RateLimitConfig = { max: 30, timeWindow: "1 minute" };

export const registerRoomRoutes: FastifyPluginAsync<RoomRoutesDeps> = async (
  app,
  opts,
) => {
  const { manager, io, jwtSecret, jwtIssuer, jwtAudience } = opts;
  const limits = opts.rateLimit ?? DEFAULT_RATE_LIMIT;

  await app.register(rateLimit, {
    global: true,
    max: limits.max,
    timeWindow: limits.timeWindow,
    errorResponseBuilder: (_req, context) => ({
      code: "RATE_LIMITED",
      message: `too many requests, retry in ${context.after}`,
    }),
  });

  app.post("/api/rooms", async (req, reply) => {
    const body = createBody.parse(req.body ?? {});
    const code = generateRoomCode();
    const hostId = randomUUID();
    const view = await manager.createRoom({ code, hostId, hostName: body.name });
    const token = await signRoomToken(
      { sub: hostId, code, role: "X" },
      { secret: jwtSecret, issuer: jwtIssuer, audience: jwtAudience, expiresIn: "24h" },
    );
    return reply.code(201).send({
      code,
      token,
      state: view.state,
      score: view.score,
      names: view.names,
      version: view.version,
    });
  });

  app.post("/api/rooms/:code/join", async (req, reply) => {
    const params = paramsSchema.parse(req.params);
    if (!isValidRoomCode(params.code)) {
      return reply.code(400).send({ code: "INVALID_CODE", message: "invalid room code format" });
    }
    const body = joinBody.parse(req.body ?? {});
    const guestId = randomUUID();
    const view = await manager.joinRoom({
      code: params.code,
      guestId,
      guestName: body.name,
    });
    await broadcastRoomState(io, manager, params.code);
    const token = await signRoomToken(
      { sub: guestId, code: params.code, role: "O" },
      { secret: jwtSecret, issuer: jwtIssuer, audience: jwtAudience, expiresIn: "24h" },
    );
    return reply.code(200).send({
      code: params.code,
      token,
      state: view.state,
      score: view.score,
      names: view.names,
      version: view.version,
    });
  });
};
