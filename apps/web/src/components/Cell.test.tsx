import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Cell } from "./Cell.js";

describe("Cell", () => {
  it("renderiza vazio quando value é null", () => {
    render(<Cell value={null} position={0} isWinning={false} disabled={false} onClick={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("");
  });

  it("renderiza X com estilo X quando value é X", () => {
    render(<Cell value="X" position={0} isWinning={false} disabled={true} onClick={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("X");
    expect(btn.className).toMatch(/text-arcade-primary/);
  });

  it("renderiza O com estilo O quando value é O", () => {
    render(<Cell value="O" position={0} isWinning={false} disabled={true} onClick={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("O");
    expect(btn.className).toMatch(/text-arcade-pink/);
  });

  it("chama onClick com a posição quando clicado e habilitado", () => {
    const onClick = vi.fn();
    render(<Cell value={null} position={4} isWinning={false} disabled={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(4);
  });

  it("não chama onClick quando disabled", () => {
    const onClick = vi.fn();
    render(<Cell value="X" position={4} isWinning={false} disabled={true} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("tem classe winning quando isWinning é true", () => {
    render(<Cell value="X" position={0} isWinning={true} disabled={true} onClick={() => {}} />);
    expect(screen.getByRole("button").className).toMatch(/animate-glow-pulse/);
  });
});
