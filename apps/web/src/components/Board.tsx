import { Cell } from "./Cell.js";

type Value = "X" | "O" | null;
type Line = readonly number[] | null;

type Props = {
  board: readonly Value[];
  line: Line;
  disabled: boolean;
  onPlay: (position: number) => void;
};

export function Board({ board, line, disabled, onPlay }: Props) {
  const winningSet = new Set(line ?? []);
  return (
    <div className="arcade-board" role="grid" aria-label="tabuleiro do jogo da velha">
      {board.map((value, i) => (
        <Cell
          key={i}
          value={value}
          position={i}
          isWinning={winningSet.has(i)}
          disabled={disabled}
          onClick={onPlay}
        />
      ))}
    </div>
  );
}
