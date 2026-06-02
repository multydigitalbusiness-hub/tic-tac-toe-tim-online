import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createRedis, type RedisHandle } from "../db/redis.js";
import { createGameManager, RoomError, type GameManager } from "./manager.js";
import { generateRoomCode, newGame, type Player } from "@ttt/shared";

let redis: RedisHandle;
let manager: GameManager;

beforeAll(async () => {
  redis = createRedis({
    url: process.env.TEST_REDIS_URL ?? "redis://localhost:6379",
    keyPrefix: "test-mgr:",
  });
  await redis.ping();
  manager = createGameManager({ redis });
});

afterAll(async () => {
  await redis.client.flushdb();
  await redis.close();
});

let code: string;
beforeEach(() => {
  code = generateRoomCode();
});

describe("createRoom", () => {
  it("cria sala com host como X e status=waiting", async () => {
    const view = await manager.createRoom({ code, hostId: "host-1", hostName: "Alice" });
    expect(view.code).toBe(code);
    expect(view.youAre).toBe("X");
    expect(view.names.X).toBe("Alice");
    expect(view.state.status).toBe("waiting");
    expect(view.state.board).toEqual(newGame().board);
    expect(view.state.turn).toBe("X");
    expect(view.version).toBe(0);
  });

  it("aceita host sem nome", async () => {
    const view = await manager.createRoom({ code, hostId: "host-1" });
    expect(view.names.X).toBeUndefined();
  });

  it("rejeita criação com código já existente", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await expect(manager.createRoom({ code, hostId: "host-2" }))
      .rejects.toBeInstanceOf(RoomError);
  });

  it("incrementa versão a cada mudança", async () => {
    const v0 = await manager.createRoom({ code, hostId: "host-1" });
    const v1 = await manager.joinRoom({ code, guestId: "guest-1" });
    expect(v1.version).toBeGreaterThan(v0.version);
  });
});

describe("getRoom", () => {
  it("retorna null para sala inexistente", async () => {
    expect(await manager.getRoom("NOEXST")).toBeNull();
  });

  it("retorna view com youAre=null quando não é player", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    const view = await manager.getRoom(code);
    expect(view).not.toBeNull();
    expect(view!.youAre).toBeNull();
    expect(view!.code).toBe(code);
  });

  it("retorna view com youAre correto para X", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    const view = await manager.getRoomAs(code, "host-1");
    expect(view!.youAre).toBe("X");
  });

  it("retorna view com youAre correto para O", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    const view = await manager.getRoomAs(code, "guest-1");
    expect(view!.youAre).toBe("O");
  });
});

describe("joinRoom", () => {
  it("atribui guest como O e muda status para playing", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    const view = await manager.joinRoom({ code, guestId: "guest-1", guestName: "Bob" });
    expect(view.youAre).toBe("O");
    expect(view.names.O).toBe("Bob");
    expect(view.state.status).toBe("playing");
  });

  it("lança NOT_FOUND para sala inexistente", async () => {
    await expect(manager.joinRoom({ code: "NOEXST", guestId: "g" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança ROOM_FULL quando já tem O e guest é novo", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await expect(manager.joinRoom({ code, guestId: "guest-2" }))
      .rejects.toMatchObject({ code: "ROOM_FULL" });
  });

  it("rejoin do mesmo guest retorna view sem erro", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    const view = await manager.joinRoom({ code, guestId: "guest-1" });
    expect(view.youAre).toBe("O");
  });
});

describe("playMove", () => {
  it("aplica jogada válida do X", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    const view = await manager.playMove({ code, userId: "host-1", pos: 4, moveId: "m1" });
    expect(view.state.board[4]).toBe("X");
    expect(view.state.turn).toBe("O");
    expect(view.state.moveCount).toBe(1);
  });

  it("aplica jogada válida do O", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await manager.playMove({ code, userId: "host-1", pos: 4, moveId: "m1" });
    const view = await manager.playMove({ code, userId: "guest-1", pos: 0, moveId: "m2" });
    expect(view.state.board[0]).toBe("O");
    expect(view.state.turn).toBe("X");
  });

  it("detecta vitória e finaliza o jogo", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await manager.playMove({ code, userId: "host-1", pos: 0, moveId: "m1" });
    await manager.playMove({ code, userId: "guest-1", pos: 3, moveId: "m2" });
    await manager.playMove({ code, userId: "host-1", pos: 1, moveId: "m3" });
    await manager.playMove({ code, userId: "guest-1", pos: 4, moveId: "m4" });
    const view = await manager.playMove({ code, userId: "host-1", pos: 2, moveId: "m5" });
    expect(view.state.status).toBe("finished");
    expect(view.state.winner).toBe("X");
    expect(view.state.line).toEqual([0, 1, 2]);
  });

  it("é idempotente para mesmo moveId", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    const v1 = await manager.playMove({ code, userId: "host-1", pos: 4, moveId: "m1" });
    const v2 = await manager.playMove({ code, userId: "host-1", pos: 4, moveId: "m1" });
    expect(v2.state.moveCount).toBe(1);
    expect(v2.version).toBe(v1.version);
  });

  it("rejeita jogada de não-jogador com NOT_PLAYER", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await expect(manager.playMove({ code, userId: "intruder", pos: 0, moveId: "m1" }))
      .rejects.toMatchObject({ code: "NOT_PLAYER" });
  });

  it("rejeita jogada na vez do outro com INVALID_MOVE", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await expect(manager.playMove({ code, userId: "guest-1", pos: 0, moveId: "m1" }))
      .rejects.toMatchObject({ code: "INVALID_MOVE" });
  });

  it("rejeita jogada em célula ocupada com INVALID_MOVE", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await manager.playMove({ code, userId: "host-1", pos: 4, moveId: "m1" });
    await expect(manager.playMove({ code, userId: "guest-1", pos: 4, moveId: "m2" }))
      .rejects.toMatchObject({ code: "INVALID_MOVE" });
  });

  it("rejeita jogada em jogo finalizado", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await manager.playMove({ code, userId: "host-1", pos: 0, moveId: "m1" });
    await manager.playMove({ code, userId: "guest-1", pos: 3, moveId: "m2" });
    await manager.playMove({ code, userId: "host-1", pos: 1, moveId: "m3" });
    await manager.playMove({ code, userId: "guest-1", pos: 4, moveId: "m4" });
    await manager.playMove({ code, userId: "host-1", pos: 2, moveId: "m5" });
    await expect(manager.playMove({ code, userId: "guest-1", pos: 5, moveId: "m6" }))
      .rejects.toMatchObject({ code: "INVALID_MOVE" });
  });

  it("lança NOT_FOUND para sala inexistente", async () => {
    await expect(manager.playMove({ code: "NOEXST", userId: "h", pos: 0, moveId: "m1" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("restartGame", () => {
  async function finishGame() {
    await manager.createRoom({ code, hostId: "host-1", hostName: "Alice" });
    await manager.joinRoom({ code, guestId: "guest-1", guestName: "Bob" });
    await manager.playMove({ code, userId: "host-1", pos: 0, moveId: "m1" });
    await manager.playMove({ code, userId: "guest-1", pos: 3, moveId: "m2" });
    await manager.playMove({ code, userId: "host-1", pos: 1, moveId: "m3" });
    await manager.playMove({ code, userId: "guest-1", pos: 4, moveId: "m4" });
    await manager.playMove({ code, userId: "host-1", pos: 2, moveId: "m5" });
  }

  it("reseta tabuleiro mantendo jogadores", async () => {
    await finishGame();
    const view = await manager.restartGame({ code, userId: "host-1" });
    expect(view.state.status).toBe("playing");
    expect(view.state.board).toEqual(newGame().board);
    expect(view.state.moveCount).toBe(0);
    expect(view.state.winner).toBeNull();
    expect(view.names.X).toBe("Alice");
    expect(view.names.O).toBe("Bob");
  });

  it("permite novo jogo do zero após restart", async () => {
    await finishGame();
    await manager.restartGame({ code, userId: "host-1" });
    const view = await manager.playMove({ code, userId: "host-1", pos: 0, moveId: "new1" });
    expect(view.state.board[0]).toBe("X");
    expect(view.state.moveCount).toBe(1);
  });

  it("rejeita restart de jogo em andamento com NOT_FINISHED", async () => {
    await manager.createRoom({ code, hostId: "host-1" });
    await manager.joinRoom({ code, guestId: "guest-1" });
    await expect(manager.restartGame({ code, userId: "host-1" }))
      .rejects.toMatchObject({ code: "NOT_FINISHED" });
  });

  it("rejeita restart de não-jogador", async () => {
    await finishGame();
    await expect(manager.restartGame({ code, userId: "intruder" }))
      .rejects.toMatchObject({ code: "NOT_PLAYER" });
  });
});
