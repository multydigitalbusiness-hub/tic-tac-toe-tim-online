import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, type ServerHandle } from "../server.js";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { signRoomToken } from "../auth/jwt.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long-for-jose";
const ISSUER = "ttt-server";
const AUDIENCE = "ttt-room";

let server: ServerHandle;
let baseUrl: string;

beforeAll(async () => {
  server = await createServer({
    config: {
      port: 0,
      nodeEnv: "test",
      redisUrl: process.env.TEST_REDIS_URL ?? "redis://localhost:6379",
      corsOrigins: ["http://localhost:5173"],
      jwtSecret: JWT_SECRET,
      logLevel: "silent",
    },
  });
  await server.start();
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await server.stop();
});

describe("server: HTTP", () => {
  it("GET /health retorna 200 com redis up", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, redis: "up" });
  });
});

describe("server: Socket.IO auth", () => {
  it("aceita conexão com JWT válido no handshake", async () => {
    const token = await signRoomToken(
      { sub: "user-1", code: "ABC234", role: "X" },
      { secret: JWT_SECRET, issuer: ISSUER, audience: AUDIENCE },
    );
    const client: ClientSocket = ioClient(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("connect_error", (err) => reject(err));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it("rejeita conexão sem token", async () => {
    const client = ioClient(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
    });
    const err = await new Promise<Error>((resolve) => {
      client.once("connect_error", (e) => resolve(e));
      setTimeout(() => resolve(new Error("timeout")), 3000);
    });
    expect(err.message).toMatch(/unauthorized|token/i);
    client.disconnect();
  });

  it("rejeita conexão com token inválido", async () => {
    const client = ioClient(baseUrl, {
      auth: { token: "invalid-jwt" },
      transports: ["websocket"],
      reconnection: false,
    });
    const err = await new Promise<Error>((resolve) => {
      client.once("connect_error", (e) => resolve(e));
      setTimeout(() => resolve(new Error("timeout")), 3000);
    });
    expect(err.message).toMatch(/unauthorized|token/i);
    client.disconnect();
  });

  it("rejeita conexão com token assinado por segredo diferente", async () => {
    const token = await signRoomToken(
      { sub: "user-1", code: "ABC234", role: "X" },
      { secret: "outro-segredo-32-chars-min-para-teste", issuer: ISSUER, audience: AUDIENCE },
    );
    const client = ioClient(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    const err = await new Promise<Error>((resolve) => {
      client.once("connect_error", (e) => resolve(e));
      setTimeout(() => resolve(new Error("timeout")), 3000);
    });
    expect(err.message).toMatch(/unauthorized|token/i);
    client.disconnect();
  });
});
