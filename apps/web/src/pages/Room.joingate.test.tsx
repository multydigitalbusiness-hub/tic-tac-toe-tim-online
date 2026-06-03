import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ code: "ABC234" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../store/gameStore.js", () => ({
  useGameStore: () => ({
    code: null,
    token: null,
    state: null,
    score: null,
    youAre: null,
    names: {},
    version: 0,
    connection: "disconnected",
    error: null,
    setRoom: vi.fn(),
    updateState: vi.fn(),
    setConnection: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("../hooks/useGameSocket.js", () => ({
  useGameSocket: () => ({ play: vi.fn(), restart: vi.fn() }),
}));

vi.mock("../lib/socket.js", () => ({
  getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn(), disconnect: vi.fn() }),
  apiToWsUrl: () => "ws://localhost:3001",
  disposeSocket: vi.fn(),
}));

import { Room } from "./Room.tsx";

describe("Room - JoinGate (sem token)", () => {
  beforeEach(() => navigateMock.mockClear());
  afterEach(() => vi.clearAllMocks());

  it("renderiza o JoinGate quando não há token para a sala", async () => {
    render(<Room />);
    expect(await screen.findByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/ABC234/)).toBeInTheDocument();
  });

  it("não redireciona para o Home quando o código é válido mas falta token", () => {
    render(<Room />);
    expect(navigateMock).not.toHaveBeenCalledWith("/", { replace: true });
  });
});
