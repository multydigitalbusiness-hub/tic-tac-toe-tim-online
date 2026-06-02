import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createRedis, type RedisHandle } from "../db/redis.js";
import { createGameManager, type GameManager } from "../game/manager.js";
import { registerHealthRoutes, registerErrorHandler, registerRoomRoutes } from "./routes.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long-for-jose";
const ISSUER = "ttt-server";
const AUDIENCE = "ttt-room";

let app: FastifyInstance;
let redis: RedisHandle;
let manager: GameManager;

beforeAll(async () => {
  redis = createRedis({
    url: process.env.TEST_REDIS_URL ?? "redis://localhost:6379",
    keyPrefix: "test-rt:",
  });
  await redis.ping();
  manager = createGameManager({ redis });
  app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(registerHealthRoutes, { redis });
  await app.register(registerRoomRoutes, {
    manager,
    jwtSecret: JWT_SECRET,
    jwtIssuer: ISSUER,
    jwtAudience: AUDIENCE,
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

async function createRoom(name?: string): Promise<{ code: string; token: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: name ? { name } : {},
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe("POST /api/rooms", () => {
  it("retorna 201 com code de 6 chars e token JWT", async () => {
    const body = await createRoom("Alice");
    expect(body.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(body.token).toBeTypeOf("string");
    expect(body.token.split(".")).toHaveLength(3);
    expect(body.state.status).toBe("waiting");
  });

  it("token decodifica para role X e o code correto", async () => {
    const { code, token } = await createRoom();
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    expect(payload.role).toBe("X");
    expect(payload.code).toBe(code);
    expect(payload.sub).toBeTypeOf("string");
  });

  it("aceita criação sem nome", async () => {
    const body = await createRoom();
    expect(body.state).toBeDefined();
  });

  it("rejeita name com mais de 20 chars", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { name: "x".repeat(21) },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/rooms/:code/join", () => {
  it("retorna 200 com token JWT (role O) e state", async () => {
    const { code } = await createRoom("Alice");
    const res = await app.inject({
      method: "POST",
      url: `/api/rooms/${code}/join`,
      payload: { name: "Bob" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(code);
    expect(body.token).toBeTypeOf("string");
    const payload = JSON.parse(Buffer.from(body.token.split(".")[1]!, "base64url").toString());
    expect(payload.role).toBe("O");
    expect(payload.code).toBe(code);
    expect(body.state.status).toBe("playing");
  });

  it("retorna 404 para sala inexistente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rooms/NOEXST/join",
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("retorna 409 quando sala já tem 2 jogadores", async () => {
    const { code } = await createRoom("Alice");
    const r1 = await app.inject({ method: "POST", url: `/api/rooms/${code}/join`, payload: {} });
    expect(r1.statusCode).toBe(200);
    const r2 = await app.inject({ method: "POST", url: `/api/rooms/${code}/join`, payload: {} });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().code).toBe("ROOM_FULL");
  });

  it("retorna 400 para código com formato inválido", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rooms/abc/join",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_CODE");
  });
});
