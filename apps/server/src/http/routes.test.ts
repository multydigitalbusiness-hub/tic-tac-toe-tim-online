import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./routes.js";
import { createRedis, type RedisHandle } from "../db/redis.js";

describe("GET /health", () => {
  let app: FastifyInstance;
  let redis: RedisHandle;

  beforeAll(async () => {
    redis = createRedis({ url: process.env.TEST_REDIS_URL ?? "redis://localhost:6379", keyPrefix: "test-rt:" });
    await redis.ping();
    app = Fastify({ logger: false });
    await registerHealthRoutes(app, { redis });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await redis.client.flushdb();
    await redis.close();
  });

  it("retorna 200 com { ok: true, redis: 'up' } quando Redis está saudável", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, redis: "up" });
  });

  it("retorna 503 com { ok: false, redis: 'down' } quando Redis falha", async () => {
    const brokenRedis = {
      client: {} as any,
      ping: vi.fn().mockRejectedValue(new Error("connection lost")),
      close: async () => {},
    } as unknown as RedisHandle;
    const app2 = Fastify({ logger: false });
    await registerHealthRoutes(app2, { redis: brokenRedis });
    await app2.ready();

    const res = await app2.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, redis: "down" });
    await app2.close();
  });
});
