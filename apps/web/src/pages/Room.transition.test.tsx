import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { newGame } from "@ttt/shared";

const navigateMock = vi.fn();

// Mutable store state; flipped mid-test to simulate joining the room.
let storeState: any;
function makeStore(overrides: any = {}) {
  return {
    code: null,
    token: null,
    state: null,
    score: null,
    youAre: null,
    names: {},
    version: 0,
    connection: "connected",
    error: null,
    setRoom: vi.fn(),
    updateState: vi.fn(),
    setConnection: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

vi.mock("react-router-dom", () => ({
  useParams: () => ({ code: "ABC234" }),
  useNavigate: () => navigateMock,
}));

// Selector-aware store mock: supports both useGameStore() and useGameStore(s => s.x).
vi.mock("../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: any) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

// NOTE: useGameSocket is intentionally NOT mocked so its real hooks count.
vi.mock("../lib/socket.js", () => ({
  getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn(), disconnect: vi.fn() }),
  apiToWsUrl: () => "ws://localhost:3001",
  disposeSocket: vi.fn(),
}));

import { Room } from "./Room.tsx";

describe("Room - transição gate→tabuleiro (Rules of Hooks)", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    storeState = makeStore();
  });
  afterEach(() => vi.clearAllMocks());

  it("não quebra ao passar de sem-token para com-token", () => {
    const { rerender } = render(<Room />);
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();

    // Simula o join concluído: token + estado desta sala.
    storeState = makeStore({
      code: "ABC234",
      token: "tok",
      state: { ...newGame(), status: "playing" },
      score: { X: 0, O: 0, draws: 0 },
      youAre: "O",
      names: { O: "Bob" },
      version: 1,
    });

    expect(() => {
      act(() => {
        rerender(<Room />);
      });
    }).not.toThrow();

    expect(screen.getByTestId("share-link-button")).toBeInTheDocument();
  });
});
