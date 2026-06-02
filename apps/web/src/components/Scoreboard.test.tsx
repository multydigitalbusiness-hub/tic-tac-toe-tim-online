import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Scoreboard } from "./Scoreboard.js";

describe("Scoreboard", () => {
  it("renderiza score X e O com 0 inicial", () => {
    render(<Scoreboard names={{}} youAre={null} score={null} />);
    expect(screen.getByTestId("score-x").textContent).toBe("0");
    expect(screen.getByTestId("score-o").textContent).toBe("0");
    expect(screen.getByTestId("score-draws").textContent).toBe("EMPATES: 0");
  });

  it("renderiza placar X=2, O=1, draws=1", () => {
    render(
      <Scoreboard
        names={{ X: "Alice", O: "Bob" }}
        youAre="X"
        score={{ X: 2, O: 1, draws: 1 }}
      />,
    );
    expect(screen.getByTestId("score-x").textContent).toBe("2");
    expect(screen.getByTestId("score-o").textContent).toBe("1");
    expect(screen.getByTestId("score-draws").textContent).toBe("EMPATES: 1");
  });

  it("X líder: borda verde em X, sem borda em O", () => {
    const { container } = render(
      <Scoreboard names={{}} youAre={null} score={{ X: 3, O: 1, draws: 0 }} />,
    );
    const xBox = container.querySelector('[data-testid="scoreboard-x"]');
    const oBox = container.querySelector('[data-testid="scoreboard-o"]');
    expect(xBox?.className).toMatch(/border-arcade-primary/);
    expect(oBox?.className).not.toMatch(/border-arcade-primary/);
  });

  it("O líder: borda verde em O, sem borda em X", () => {
    const { container } = render(
      <Scoreboard names={{}} youAre={null} score={{ X: 0, O: 2, draws: 0 }} />,
    );
    const xBox = container.querySelector('[data-testid="scoreboard-x"]');
    const oBox = container.querySelector('[data-testid="scoreboard-o"]');
    expect(oBox?.className).toMatch(/border-arcade-primary/);
    expect(xBox?.className).not.toMatch(/border-arcade-primary/);
  });

  it("empate (X=O): borda amarela em ambos", () => {
    const { container } = render(
      <Scoreboard names={{}} youAre={null} score={{ X: 1, O: 1, draws: 0 }} />,
    );
    const xBox = container.querySelector('[data-testid="scoreboard-x"]');
    const oBox = container.querySelector('[data-testid="scoreboard-o"]');
    expect(xBox?.className).toMatch(/border-arcade-yellow/);
    expect(oBox?.className).toMatch(/border-arcade-yellow/);
  });

  it("empate 0-0: borda amarela em ambos (se score carregado)", () => {
    const { container } = render(
      <Scoreboard names={{}} youAre={null} score={{ X: 0, O: 0, draws: 0 }} />,
    );
    const xBox = container.querySelector('[data-testid="scoreboard-x"]');
    const oBox = container.querySelector('[data-testid="scoreboard-o"]');
    expect(xBox?.className).toMatch(/border-arcade-yellow/);
    expect(oBox?.className).toMatch(/border-arcade-yellow/);
  });

  it("score=null: nenhum destaque de líder", () => {
    const { container } = render(
      <Scoreboard names={{}} youAre={null} score={null} />,
    );
    const xBox = container.querySelector('[data-testid="scoreboard-x"]');
    const oBox = container.querySelector('[data-testid="scoreboard-o"]');
    expect(xBox?.className).not.toMatch(/border-arcade-primary/);
    expect(xBox?.className).not.toMatch(/border-arcade-yellow/);
    expect(oBox?.className).not.toMatch(/border-arcade-primary/);
    expect(oBox?.className).not.toMatch(/border-arcade-yellow/);
  });

  it("mostra nome do jogador ou '—' para O sem nome", () => {
    render(<Scoreboard names={{}} youAre="X" score={null} />);
    const scoreboardO = screen.getByTestId("scoreboard-o");
    expect(within(scoreboardO).getByText("—")).toBeInTheDocument();
  });
});
