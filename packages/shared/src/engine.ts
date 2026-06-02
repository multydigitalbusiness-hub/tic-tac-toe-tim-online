export type Player = "X" | "O";
export type Cell = Player | null;
export type Board = readonly Cell[];

export type GameStatus = "waiting" | "playing" | "finished";

export type GameState = {
  readonly board: Board;
  readonly turn: Player;
  readonly status: GameStatus;
  readonly winner: Player | "draw" | null;
  readonly line: readonly number[] | null;
  readonly moveCount: number;
};

export class InvalidMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoveError";
  }
}

export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

export function newGame(): GameState {
  return {
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ],
    turn: "X",
    status: "playing",
    winner: null,
    line: null,
    moveCount: 0,
  };
}

export function isValidPosition(pos: number): boolean {
  return Number.isInteger(pos) && pos >= 0 && pos <= 8;
}

export function checkWinner(
  board: Board,
): { winner: Player | "draw" | null; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const cell = board[a];
    if (cell != null && cell === board[b] && cell === board[c]) {
      return { winner: cell, line: [a, b, c] as const };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: null };
  }
  return { winner: null, line: null };
}

export function applyMove(state: GameState, pos: number, player: Player): GameState {
  if (state.status !== "playing") {
    throw new InvalidMoveError(`game is ${state.status}, cannot move`);
  }
  if (!isValidPosition(pos)) {
    throw new InvalidMoveError(`position ${pos} is out of range`);
  }
  if (state.board[pos] !== null) {
    throw new InvalidMoveError(`cell ${pos} is already occupied`);
  }
  if (state.turn !== player) {
    throw new InvalidMoveError(
      `not your turn (turn=${state.turn}, player=${player})`,
    );
  }

  const board: Cell[] = [...state.board];
  board[pos] = player;

  const { winner, line } = checkWinner(board);
  const isTerminal = winner !== null;
  const nextTurn: Player = player === "X" ? "O" : "X";

  return {
    board,
    turn: isTerminal ? player : nextTurn,
    status: isTerminal ? "finished" : "playing",
    winner,
    line,
    moveCount: state.moveCount + 1,
  };
}

export function boardToString(board: Board): string {
  return board.map((c) => c ?? "_").join("");
}

export function boardFromString(s: string): Board {
  if (s.length !== 9) {
    throw new Error(`board string must be 9 chars, got ${s.length}`);
  }
  const cells: Cell[] = [];
  for (const ch of s) {
    if (ch === "X") cells.push("X");
    else if (ch === "O") cells.push("O");
    else if (ch === "_") cells.push(null);
    else throw new Error(`invalid char in board string: ${ch}`);
  }
  return cells;
}
