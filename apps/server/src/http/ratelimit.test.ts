import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createRedis, type RedisHandle } from "../db/redis.js";
import { createGameManager, type GameManager } from "../game/manager.js";
import { registerErrorHandler, registerRoomRoutes } from "./routes.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long-for-jose";

let app: FastifyInstance;
let redis: RedisHandle;
let manager: GameManager;

beforeAll(async () => {
  redis = createRedis({
    url: process.env.TEST_REDIS_URL ?? "redis://localhost:6379",
    keyPrefix: "test-rl:",
  });
  await redis.ping();
  manager = createGameManager({ redis });
  app = Fastify({ logger: false });
  registerErrorHandler(app);
  const fakeIo = { in: () => ({ fetchSockets: async () => [] }) } as never;
  await app.register(registerRoomRoutes, {
    manager,
    io: fakeIo,
    jwtSecret: JWT_SECRET,
    jwtIssuer: "ttt-server",
    jwtAudience: "ttt-room",
    rateLimit: { max: 3, timeWindow: "1 minute" },
  });
  await app.ready();
});

beforeEach(async () => {
  await redis.client.flushdb();
});

afterAll(async () => {
  await app.close();
  await redis.close();
});

describe("rate limiting", () => {
  it("retorna 429 após exceder o limite de criação de salas", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
      statuses.push(res.statusCode);
    }
    expect(statuses.filter((s) => s === 201).length).toBe(3);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  it("a resposta 429 inclui um código de erro estruturado", async () => {
    let last: { statusCode: number; json: () => any } | null = null;
    for (let i = 0; i < 5; i++) {
      last = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
    }
    expect(last!.statusCode).toBe(429);
    expect(last!.json().code).toBe("RATE_LIMITED");
  });
});
