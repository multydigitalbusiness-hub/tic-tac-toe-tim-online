import { describe, it, expect } from "vitest";
import {
  applyMove,
  newGame,
  checkWinner,
  boardFromString,
  boardToString,
  isValidPosition,
  InvalidMoveError,
  type Board,
} from "./engine.js";

const emptyBoard: Board = [
  null, null, null,
  null, null, null,
  null, null, null,
];

describe("newGame", () => {
  it("retorna tabuleiro vazio com X começando", () => {
    const g = newGame();
    expect(g.board).toEqual(emptyBoard);
    expect(g.turn).toBe("X");
    expect(g.status).toBe("playing");
    expect(g.winner).toBeNull();
    expect(g.line).toBeNull();
    expect(g.moveCount).toBe(0);
  });
});

describe("isValidPosition", () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])("aceita posição %i", (pos) => {
    expect(isValidPosition(pos)).toBe(true);
  });

  it.each([-1, -10, 9, 10, 100])("rejeita posição fora do range: %i", (pos) => {
    expect(isValidPosition(pos)).toBe(false);
  });

  it.each([1.5, 3.7, NaN, Infinity, -Infinity])("rejeita não-inteiro: %s", (pos) => {
    expect(isValidPosition(pos)).toBe(false);
  });
});

describe("applyMove - caso feliz", () => {
  it("coloca a peça na célula vazia", () => {
    const g = newGame();
    const next = applyMove(g, 4, "X");
    expect(next.board[4]).toBe("X");
    expect(next.moveCount).toBe(1);
    expect(next.turn).toBe("O");
  });

  it("alterna a vez após uma jogada", () => {
    let g = newGame();
    g = applyMove(g, 0, "X");
    expect(g.turn).toBe("O");
    g = applyMove(g, 1, "O");
    expect(g.turn).toBe("X");
  });

  it("não muta o estado original (imutabilidade)", () => {
    const g = newGame();
    const before = g.board;
    applyMove(g, 0, "X");
    expect(g.board).toBe(before);
    expect(g.board[0]).toBeNull();
  });
});

describe("applyMove - validações", () => {
  it("rejeita jogada em célula ocupada", () => {
    const g = applyMove(newGame(), 4, "X");
    expect(() => applyMove(g, 4, "O")).toThrow(InvalidMoveError);
    expect(() => applyMove(g, 4, "O")).toThrow(/occupied/i);
  });

  it("rejeita posição negativa", () => {
    expect(() => applyMove(newGame(), -1, "X")).toThrow(InvalidMoveError);
  });

  it("rejeita posição >= 9", () => {
    expect(() => applyMove(newGame(), 9, "X")).toThrow(InvalidMoveError);
  });

  it("rejeita posição não-inteira", () => {
    expect(() => applyMove(newGame(), 1.5, "X")).toThrow(InvalidMoveError);
  });

  it("rejeita jogada do jogador errado", () => {
    expect(() => applyMove(newGame(), 0, "O")).toThrow(/not your turn/i);
  });

  it("rejeita jogada após o jogo terminar", () => {
    let g = newGame();
    g = applyMove(g, 0, "X");
    g = applyMove(g, 3, "O");
    g = applyMove(g, 1, "X");
    g = applyMove(g, 4, "O");
    g = applyMove(g, 2, "X");
    expect(g.status).toBe("finished");
    expect(() => applyMove(g, 5, "O")).toThrow(InvalidMoveError);
  });
});

describe("checkWinner - linhas horizontais", () => {
  it("X vence linha superior", () => {
    const board: Board = ["X", "X", "X", null, null, null, null, null, null];
    expect(checkWinner(board)).toEqual({ winner: "X", line: [0, 1, 2] });
  });

  it("O vence linha do meio", () => {
    const board: Board = [null, null, null, "O", "O", "O", null, null, null];
    expect(checkWinner(board)).toEqual({ winner: "O", line: [3, 4, 5] });
  });

  it("X vence linha inferior", () => {
    const board: Board = [null, null, null, null, null, null, "X", "X", "X"];
    expect(checkWinner(board)).toEqual({ winner: "X", line: [6, 7, 8] });
  });
});

describe("checkWinner - colunas", () => {
  it("X vence coluna esquerda", () => {
    const board: Board = ["X", null, null, "X", null, null, "X", null, null];
    expect(checkWinner(board)).toEqual({ winner: "X", line: [0, 3, 6] });
  });

  it("O vence coluna central", () => {
    const board: Board = [null, "O", null, null, "O", null, null, "O", null];
    expect(checkWinner(board)).toEqual({ winner: "O", line: [1, 4, 7] });
  });

  it("X vence coluna direita", () => {
    const board: Board = [null, null, "X", null, null, "X", null, null, "X"];
    expect(checkWinner(board)).toEqual({ winner: "X", line: [2, 5, 8] });
  });
});

describe("checkWinner - diagonais", () => {
  it("X vence diagonal principal", () => {
    const board: Board = ["X", null, null, null, "X", null, null, null, "X"];
    expect(checkWinner(board)).toEqual({ winner: "X", line: [0, 4, 8] });
  });

  it("O vence diagonal anti-principal", () => {
    const board: Board = [null, null, "O", null, "O", null, "O", null, null];
    expect(checkWinner(board)).toEqual({ winner: "O", line: [2, 4, 6] });
  });
});

describe("checkWinner - sem vencedor", () => {
  it("retorna null quando o jogo está em andamento", () => {
    const board: Board = ["X", "O", null, null, null, null, null, null, null];
    expect(checkWinner(board)).toEqual({ winner: null, line: null });
  });

  it("detecta empate quando o tabuleiro está cheio sem três em linha", () => {
    const board: Board = [
      "X", "O", "X",
      "X", "O", "O",
      "O", "X", "X",
    ];
    expect(checkWinner(board)).toEqual({ winner: "draw", line: null });
  });

  it("detecta empate em outro padrão", () => {
    const board: Board = [
      "X", "X", "O",
      "O", "O", "X",
      "X", "O", "X",
    ];
    expect(checkWinner(board)).toEqual({ winner: "draw", line: null });
  });
});

describe("applyMove - detecção de vitória fim-a-fim", () => {
  it("X vence ao completar linha superior", () => {
    let g = newGame();
    g = applyMove(g, 0, "X");
    g = applyMove(g, 3, "O");
    g = applyMove(g, 1, "X");
    g = applyMove(g, 4, "O");
    g = applyMove(g, 2, "X");
    expect(g.winner).toBe("X");
    expect(g.status).toBe("finished");
    expect(g.line).toEqual([0, 1, 2]);
    expect(g.turn).toBe("X");
  });

  it("O vence na última jogada possível (diagonal)", () => {
    let g = newGame();
    g = applyMove(g, 0, "X");
    g = applyMove(g, 4, "O");
    g = applyMove(g, 8, "X");
    g = applyMove(g, 2, "O");
    g = applyMove(g, 1, "X");
    g = applyMove(g, 6, "O");
    expect(g.winner).toBe("O");
    expect(g.line).toEqual([2, 4, 6]);
  });

  it("detecta empate na 9ª jogada", () => {
    // tabuleiro final esperado:
    // X O X
    // X O O
    // O X X
    let g = newGame();
    g = applyMove(g, 0, "X");
    g = applyMove(g, 1, "O");
    g = applyMove(g, 2, "X");
    g = applyMove(g, 4, "O");
    g = applyMove(g, 3, "X");
    g = applyMove(g, 5, "O");
    g = applyMove(g, 7, "X");
    g = applyMove(g, 6, "O");
    g = applyMove(g, 8, "X");
    expect(g.winner).toBe("draw");
    expect(g.status).toBe("finished");
    expect(g.moveCount).toBe(9);
  });
});

describe("boardToString e boardFromString", () => {
  it("serializa tabuleiro vazio como 9 underscores", () => {
    expect(boardToString(emptyBoard)).toBe("_________");
  });

  it("serializa tabuleiro com peças", () => {
    const board: Board = ["X", null, "O", null, "X", null, "O", null, null];
    expect(boardToString(board)).toBe("X_O_X_O__");
  });

  it("faz round-trip de tabuleiro vazio", () => {
    const g = newGame();
    const s = boardToString(g.board);
    expect(boardFromString(s)).toEqual(g.board);
  });

  it("faz round-trip de tabuleiro com peças", () => {
    const board: Board = ["X", "O", "X", "O", "X", "O", "X", "O", "X"];
    const s = boardToString(board);
    expect(boardFromString(s)).toEqual(board);
  });

  it("lança erro em string de tamanho errado", () => {
    expect(() => boardFromString("XXX")).toThrow();
    expect(() => boardFromString("")).toThrow();
    expect(() => boardFromString("XXXXXXXXXX")).toThrow();
  });

  it("lança erro em caractere inválido", () => {
    expect(() => boardFromString("XXX_YYYYY")).toThrow(/invalid/i);
    expect(() => boardFromString("ABCDEFGHI")).toThrow(/invalid/i);
  });
});
