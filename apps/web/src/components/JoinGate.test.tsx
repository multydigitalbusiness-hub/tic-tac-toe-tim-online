import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JoinGate } from "./JoinGate.tsx";

function setup(overrides: Partial<Parameters<typeof JoinGate>[0]> = {}) {
  const onJoin = vi.fn();
  const onBack = vi.fn();
  const props = {
    code: "ABC234",
    busy: false,
    error: null,
    onJoin,
    onBack,
    ...overrides,
  };
  render(<JoinGate {...props} />);
  return { onJoin, onBack };
}

describe("JoinGate", () => {
  it("mostra o código da sala e o input de nome quando não há erro", () => {
    setup();
    expect(screen.getByText(/ABC234/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("ENTRAR chama onJoin com o nome digitado", () => {
    const { onJoin } = setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onJoin).toHaveBeenCalledWith("Bob");
  });

  it("ENTRAR com nome vazio chama onJoin(undefined)", () => {
    const { onJoin } = setup();
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onJoin).toHaveBeenCalledWith(undefined);
  });

  it("busy desabilita o botão e mostra ENTRANDO", () => {
    setup({ busy: true });
    const btn = screen.getByRole("button", { name: /entrando/i });
    expect(btn).toBeDisabled();
  });

  it("erro NOT_FOUND mostra 'SALA NÃO ENCONTRADA'", () => {
    setup({ error: { code: "NOT_FOUND", message: "x" } });
    expect(screen.getByText(/sala não encontrada/i)).toBeInTheDocument();
  });

  it("erro ROOM_FULL mostra 'SALA CHEIA'", () => {
    setup({ error: { code: "ROOM_FULL", message: "x" } });
    expect(screen.getByText(/sala cheia/i)).toBeInTheDocument();
  });

  it("erro genérico mostra TENTAR DE NOVO e dispara onJoin ao clicar", () => {
    const { onJoin } = setup({ error: { code: "INTERNAL", message: "x" } });
    const retry = screen.getByRole("button", { name: /tentar de novo/i });
    fireEvent.click(retry);
    expect(onJoin).toHaveBeenCalled();
  });

  it("VOLTAR AO MENU chama onBack", () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole("button", { name: /voltar ao menu/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
