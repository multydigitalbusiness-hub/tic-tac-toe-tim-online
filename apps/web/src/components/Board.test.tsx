import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Board } from "./Board.js";

const EMPTY_BOARD = Array(9).fill(null) as readonly (null | "X" | "O")[];

describe("Board", () => {
  it("renderiza 9 cells", () => {
    render(<Board board={EMPTY_BOARD} line={null} disabled={false} onPlay={() => {}} />);
    for (let i = 0; i < 9; i++) {
      expect(screen.getByTestId(`cell-${i}`)).toBeInTheDocument();
    }
  });

  it("passa os valores corretos para cada cell", () => {
    const board: readonly (null | "X" | "O")[] = ["X", null, "O", null, "X", null, "O", null, null];
    render(<Board board={board} line={null} disabled={false} onPlay={() => {}} />);
    expect(screen.getByTestId("cell-0").textContent).toBe("X");
    expect(screen.getByTestId("cell-2").textContent).toBe("O");
    expect(screen.getByTestId("cell-4").textContent).toBe("X");
    expect(screen.getByTestId("cell-1").textContent).toBe("");
  });

  it("propaga click no cell para onPlay com a posição", () => {
    const onPlay = vi.fn();
    render(<Board board={EMPTY_BOARD} line={null} disabled={false} onPlay={onPlay} />);
    fireEvent.click(screen.getByTestId("cell-4"));
    expect(onPlay).toHaveBeenCalledWith(4);
  });

  it("marca cells da linha vencedora como winning", () => {
    const board: readonly (null | "X" | "O")[] = ["X", "X", "X", null, null, null, null, null, null];
    render(<Board board={board} line={[0, 1, 2]} disabled={true} onPlay={() => {}} />);
    expect(screen.getByTestId("cell-0").className).toMatch(/arcade-cell-winning/);
    expect(screen.getByTestId("cell-1").className).toMatch(/arcade-cell-winning/);
    expect(screen.getByTestId("cell-2").className).toMatch(/arcade-cell-winning/);
    expect(screen.getByTestId("cell-3").className).not.toMatch(/arcade-cell-winning/);
  });

  it("desabilita cells vazios quando disabled é true", () => {
    render(<Board board={EMPTY_BOARD} line={null} disabled={true} onPlay={() => {}} />);
    expect(screen.getByTestId("cell-0")).toBeDisabled();
  });
});
