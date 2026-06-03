import {
  applyMove,
  boardFromString,
  boardToString,
  newGame,
  InvalidMoveError,
  type Board,
  type GameState,
  type Player,
  type Score,
} from "@ttt/shared";
import type { RedisHandle } from "../db/redis.js";

const GAME_TTL_SECONDS = 24 * 60 * 60;
const MOVES_TTL_SECONDS = 60 * 60;

export class RoomError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "ROOM_EXISTS"
      | "ROOM_FULL"
      | "GAME_FINISHED"
      | "NOT_PLAYER"
      | "INVALID_MOVE"
      | "NOT_FINISHED"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

/**
 * Aplica uma jogada de forma atômica via compare-and-set otimista.
 * O servidor é a autoridade: garante que o estado não mudou entre a leitura
 * (em JS) e a escrita, evitando corridas read-modify-write.
 *
 * KEYS[1] = chave do jogo (hash)   KEYS[2] = chave do set de moveIds
 * ARGV: 1=expectedVer 2=moveId 3=board 4=turn 5=status 6=winner 7=line
 *       8=newVer 9=moveCount 10=scoreField("" se nenhum) 11=gameTtl 12=movesTtl
 * Retorna: "OK" | "DUP" | "CONFLICT" | "NOTFOUND"
 */
const APPLY_MOVE_CAS_LUA = `
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
  return 'DUP'
end
local curVer = redis.call('HGET', KEYS[1], 'ver')
if curVer == false then
  return 'NOTFOUND'
end
if curVer ~= ARGV[1] then
  return 'CONFLICT'
end
redis.call('HSET', KEYS[1],
  'board', ARGV[3],
  'turn', ARGV[4],
  'status', ARGV[5],
  'winner', ARGV[6],
  'line', ARGV[7],
  'ver', ARGV[8],
  'moveCount', ARGV[9])
if ARGV[10] ~= '' then
  redis.call('HINCRBY', KEYS[1], ARGV[10], 1)
end
redis.call('EXPIRE', KEYS[1], ARGV[11])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[12])
return 'OK'
`;

const MAX_MOVE_RETRIES = 6;

type RedisWithApplyMoveCas = {
  applyMoveCas?: (...args: (string | number)[]) => Promise<string>;
  defineCommand: (name: string, opts: { numberOfKeys: number; lua: string }) => void;
};

function ensureApplyMoveCas(client: RedisWithApplyMoveCas): void {
  if (typeof client.applyMoveCas === "function") return;
  client.defineCommand("applyMoveCas", {
    numberOfKeys: 2,
    lua: APPLY_MOVE_CAS_LUA,
  });
}

export type RoomView = {
  code: string;
  state: GameState;
  score: Score;
  youAre: Player | null;
  names: { X?: string; O?: string };
  version: number;
};

export type CreateRoomOpts = {
  code: string;
  hostId: string;
  hostName?: string;
};

export type JoinRoomOpts = {
  code: string;
  guestId: string;
  guestName?: string;
};

export type PlayMoveOpts = {
  code: string;
  userId: string;
  pos: number;
  moveId: string;
};

export type RestartOpts = {
  code: string;
  userId: string;
};

type RawGame = {
  board: string;
  turn: string;
  pX: string;
  pO: string;
  pXName: string;
  pOName: string;
  status: string;
  winner: string;
  line: string;
  ver: string;
  moveCount: string;
  scoreX: string;
  scoreO: string;
  scoreDraw: string;
  createdAt?: string;
};

export type GameDeps = {
  redis: RedisHandle;
};

export type GameManager = {
  createRoom: (opts: CreateRoomOpts) => Promise<RoomView>;
  getRoom: (code: string) => Promise<RoomView | null>;
  getRoomAs: (code: string, userId: string) => Promise<RoomView | null>;
  joinRoom: (opts: JoinRoomOpts) => Promise<RoomView>;
  playMove: (opts: PlayMoveOpts) => Promise<RoomView>;
  restartGame: (opts: RestartOpts) => Promise<RoomView>;
};

export function createGameManager(deps: GameDeps): GameManager {
  const { redis } = deps;
  const k = (code: string) => `game:${code}`;
  const movesK = (code: string) => `game:${code}:moves`;
  ensureApplyMoveCas(redis.client as unknown as RedisWithApplyMoveCas);

  function getRole(data: RawGame, userId: string): Player | null {
    if (data.pX === userId) return "X";
    if (data.pO === userId) return "O";
    return null;
  }

  function dataToView(code: string, data: RawGame, youAre: Player | null): RoomView {
    const state: GameState = {
      board: boardFromString(data.board),
      turn: data.turn as Player,
      status: data.status as GameState["status"],
      winner: (data.winner || null) as GameState["winner"],
      line: data.line ? data.line.split(",").map((n) => parseInt(n, 10)) : null,
      moveCount: parseInt(data.moveCount, 10),
    };
    const names: { X?: string; O?: string } = {};
    if (data.pXName) names.X = data.pXName;
    if (data.pOName) names.O = data.pOName;
    return {
      code,
      state,
      score: {
        X: parseInt(data.scoreX ?? "0", 10),
        O: parseInt(data.scoreO ?? "0", 10),
        draws: parseInt(data.scoreDraw ?? "0", 10),
      },
      youAre,
      names,
      version: parseInt(data.ver, 10),
    };
  }

  async function readGame(code: string): Promise<RawGame | null> {
    const data = (await redis.client.hgetall(k(code))) as unknown as RawGame;
    if (!data || !data.board) return null;
    return data;
  }

  async function getRoom(code: string): Promise<RoomView | null> {
    const data = await readGame(code);
    if (!data) return null;
    return dataToView(code, data, null);
  }

  async function getRoomAs(code: string, userId: string): Promise<RoomView | null> {
    const data = await readGame(code);
    if (!data) return null;
    return dataToView(code, data, getRole(data, userId));
  }

  async function createRoom(opts: CreateRoomOpts): Promise<RoomView> {
    const existing = await readGame(opts.code);
    if (existing) {
      throw new RoomError("ROOM_EXISTS", `room ${opts.code} already exists`);
    }
    const state = newGame();
    await redis.client.hset(k(opts.code), {
      board: boardToString(state.board),
      turn: state.turn,
      pX: opts.hostId,
      pO: "",
      pXName: opts.hostName ?? "",
      pOName: "",
      status: "waiting",
      winner: "",
      line: "",
      ver: "0",
      moveCount: "0",
      scoreX: "0",
      scoreO: "0",
      scoreDraw: "0",
      createdAt: String(Date.now()),
    });
    await redis.client.expire(k(opts.code), GAME_TTL_SECONDS);
    const data = await readGame(opts.code);
    return dataToView(opts.code, data!, "X");
  }

  async function joinRoom(opts: JoinRoomOpts): Promise<RoomView> {
    const data = await readGame(opts.code);
    if (!data) {
      throw new RoomError("NOT_FOUND", `room ${opts.code} not found`);
    }
    if (data.pO && data.pO !== opts.guestId) {
      throw new RoomError("ROOM_FULL", `room ${opts.code} is full`);
    }
    if (data.status === "finished") {
      throw new RoomError("GAME_FINISHED", `room ${opts.code} game is finished`);
    }

    if (data.pO === opts.guestId) {
      return dataToView(opts.code, data, "O");
    }

    await redis.client.hset(k(opts.code), {
      pO: opts.guestId,
      pOName: opts.guestName ?? "",
      status: "playing",
      ver: String(parseInt(data.ver, 10) + 1),
    });
    await redis.client.expire(k(opts.code), GAME_TTL_SECONDS);
    const newData = await readGame(opts.code);
    return dataToView(opts.code, newData!, "O");
  }

  async function playMove(opts: PlayMoveOpts): Promise<RoomView> {
    for (let attempt = 0; attempt < MAX_MOVE_RETRIES; attempt++) {
      const data = await readGame(opts.code);
      if (!data) {
        throw new RoomError("NOT_FOUND", `room ${opts.code} not found`);
      }

      const seen = await redis.client.sismember(movesK(opts.code), opts.moveId);
      if (seen) {
        return dataToView(opts.code, data, getRole(data, opts.userId));
      }

      const role = getRole(data, opts.userId);
      if (!role) {
        throw new RoomError("NOT_PLAYER", `user ${opts.userId} is not a player in this room`);
      }

      const state: GameState = {
        board: boardFromString(data.board),
        turn: data.turn as Player,
        status: data.status as GameState["status"],
        winner: (data.winner || null) as GameState["winner"],
        line: data.line ? data.line.split(",").map((n) => parseInt(n, 10)) : null,
        moveCount: parseInt(data.moveCount, 10),
      };

      let nextState: GameState;
      try {
        nextState = applyMove(state, opts.pos, role);
      } catch (e) {
        if (e instanceof InvalidMoveError) {
          throw new RoomError("INVALID_MOVE", e.message);
        }
        throw e;
      }

      const expectedVer = parseInt(data.ver, 10);
      const scoreField =
        nextState.status === "finished"
          ? nextState.winner === "X"
            ? "scoreX"
            : nextState.winner === "O"
              ? "scoreO"
              : nextState.winner === "draw"
                ? "scoreDraw"
                : ""
          : "";

      const client = redis.client as unknown as RedisWithApplyMoveCas;
      const result = await client.applyMoveCas!(
        k(opts.code),
        movesK(opts.code),
        String(expectedVer),
        opts.moveId,
        boardToString(nextState.board),
        nextState.turn,
        nextState.status,
        nextState.winner ?? "",
        nextState.line ? nextState.line.join(",") : "",
        String(expectedVer + 1),
        String(nextState.moveCount),
        scoreField,
        String(GAME_TTL_SECONDS),
        String(MOVES_TTL_SECONDS),
      );

      if (result === "OK" || result === "DUP") {
        const newData = await readGame(opts.code);
        return dataToView(opts.code, newData!, role);
      }
      if (result === "NOTFOUND") {
        throw new RoomError("NOT_FOUND", `room ${opts.code} not found`);
      }
      // CONFLICT: estado mudou entre a leitura e a escrita; tenta novamente.
    }
    throw new RoomError("CONFLICT", `move conflict after ${MAX_MOVE_RETRIES} retries`);
  }

  async function restartGame(opts: RestartOpts): Promise<RoomView> {
    const data = await readGame(opts.code);
    if (!data) {
      throw new RoomError("NOT_FOUND", `room ${opts.code} not found`);
    }
    const role = getRole(data, opts.userId);
    if (!role) {
      throw new RoomError("NOT_PLAYER", `user ${opts.userId} is not a player in this room`);
    }
    if (data.status !== "finished") {
      throw new RoomError("NOT_FINISHED", `cannot restart a game in progress`);
    }

    const state = newGame();
    await redis.client.hset(k(opts.code), {
      board: boardToString(state.board),
      turn: state.turn,
      status: "playing",
      winner: "",
      line: "",
      ver: String(parseInt(data.ver, 10) + 1),
      moveCount: "0",
    });
    await redis.client.del(movesK(opts.code));

    const newData = await readGame(opts.code);
    return dataToView(opts.code, newData!, role);
  }

  return { createRoom, getRoom, getRoomAs, joinRoom, playMove, restartGame };
}
