import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { signRoomToken } from "../auth/jwt.js";
import { createServer, type ServerHandle } from "../server.js";
import type { RoomView } from "../game/manager.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long-for-jose";
const ISSUER = "ttt-server";
const AUDIENCE = "ttt-room";

let server: ServerHandle;
let baseUrl: string;

async function http(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json() };
}

function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const c = ioClient(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    const t = setTimeout(() => reject(new Error("connect timeout")), 3000);
    c.once("connect", () => { clearTimeout(t); resolve(c); });
    c.once("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
}

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
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  const r = await server.redis.client.flushdb();
  expect(r).toBe("OK");
});

afterAll(async () => {
  await server.stop();
});

describe("WS game flow", () => {
  it("X cria sala via HTTP, O entra via HTTP, ambos conectam WS, jogam uma partida completa", async () => {
    const create = await http("/api/rooms", { method: "POST", body: JSON.stringify({ name: "Alice" }) });
    expect(create.status).toBe(201);
    const { code, token: xToken } = create.body;

    const join = await http(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ name: "Bob" }) });
    expect(join.status).toBe(200);
    const { token: oToken } = join.body;

    const xClient = await connectClient(xToken);
    const oClient = await connectClient(oToken);

    const xStates: RoomView[] = [];
    const oStates: RoomView[] = [];
    xClient.on("state", (s: RoomView) => xStates.push(s));
    oClient.on("state", (s: RoomView) => oStates.push(s));

    await new Promise((r) => setTimeout(r, 100));

    const playMove = (client: ClientSocket, pos: number, id: string): Promise<any> =>
      new Promise((resolve) => {
        client.emit("move", { pos, id }, (ack: any) => resolve(ack));
      });

    const a1 = await playMove(xClient, 0, "m1");
    expect(a1.ok).toBe(true);
    const a2 = await playMove(oClient, 3, "m2");
    expect(a2.ok).toBe(true);
    const a3 = await playMove(xClient, 1, "m3");
    expect(a3.ok).toBe(true);
    const a4 = await playMove(oClient, 4, "m4");
    expect(a4.ok).toBe(true);
    const a5 = await playMove(xClient, 2, "m5");
    expect(a5.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    const finalX = xStates[xStates.length - 1];
    const finalO = oStates[oStates.length - 1];
    expect(finalX.state.status).toBe("finished");
    expect(finalX.state.winner).toBe("X");
    expect(finalX.state.line).toEqual([0, 1, 2]);
    expect(finalX.youAre).toBe("X");
    expect(finalO.state.status).toBe("finished");
    expect(finalO.state.winner).toBe("X");
    expect(finalO.youAre).toBe("O");

    xClient.disconnect();
    oClient.disconnect();
  });

  it("jogada inválida envia 'error' ao remetente sem afetar estado", async () => {
    const create = await http("/api/rooms", { method: "POST", body: "{}" });
    const { code, token: xToken } = create.body;
    const join = await http(`/api/rooms/${code}/join`, { method: "POST", body: "{}" });
    const { token: oToken } = join.body;
    const xClient = await connectClient(xToken);
    const oClient = await connectClient(oToken);

    const errors: any[] = [];
    oClient.on("error", (e: any) => errors.push(e));

    const ack = await new Promise<any>((resolve) => {
      oClient.emit("move", { pos: 0, id: "bad" }, (a: any) => resolve(a));
    });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe("INVALID_MOVE");
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("INVALID_MOVE");

    xClient.disconnect();
    oClient.disconnect();
  });

  it("restart reseta o tabuleiro para ambos jogadores", async () => {
    const create = await http("/api/rooms", { method: "POST", body: "{}" });
    const { code, token: xToken } = create.body;
    const join = await http(`/api/rooms/${code}/join`, { method: "POST", body: "{}" });
    const { token: oToken } = join.body;
    const xClient = await connectClient(xToken);
    const oClient = await connectClient(oToken);

    const playMove = (client: ClientSocket, pos: number, id: string): Promise<any> =>
      new Promise((resolve) => {
        client.emit("move", { pos, id }, (a: any) => resolve(a));
      });
    const restart = (client: ClientSocket): Promise<any> =>
      new Promise((resolve) => {
        client.emit("restart", {}, (a: any) => resolve(a));
      });

    await playMove(xClient, 0, "m1");
    await playMove(oClient, 3, "m2");
    await playMove(xClient, 1, "m3");
    await playMove(oClient, 4, "m4");
    await playMove(xClient, 2, "m5");

    const xStates: RoomView[] = [];
    const oStates: RoomView[] = [];
    xClient.on("state", (s: RoomView) => xStates.push(s));
    oClient.on("state", (s: RoomView) => oStates.push(s));

    const ack = await restart(xClient);
    expect(ack.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    const finalX = xStates[xStates.length - 1];
    const finalO = oStates[oStates.length - 1];
    expect(finalX.state.status).toBe("playing");
    expect(finalX.state.board.every((c) => c === null)).toBe(true);
    expect(finalO.state.status).toBe("playing");

    xClient.disconnect();
    oClient.disconnect();
  });

  it("'state' devolve o estado atual via ack", async () => {
    const create = await http("/api/rooms", { method: "POST", body: "{}" });
    const { code, token: xToken } = create.body;
    const join = await http(`/api/rooms/${code}/join`, { method: "POST", body: "{}" });
    const { token: oToken } = join.body;
    const xClient = await connectClient(xToken);
    const oClient = await connectClient(oToken);

    const ack = await new Promise<any>((resolve) => {
      xClient.emit("state", {}, (a: any) => resolve(a));
    });
    expect(ack.ok).toBe(true);
    expect(ack.view.state.status).toBe("playing");
    expect(ack.view.youAre).toBe("X");

    xClient.disconnect();
    oClient.disconnect();
  });
});
